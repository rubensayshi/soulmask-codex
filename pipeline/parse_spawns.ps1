# parse_spawns.ps1 — Extract spawn coordinates from Soulmask .umap files
#
# Pipeline:
#   1. Binary-scan all .umap files for spawner class name bytes
#   2. Export each matching .umap to JSON via UAssetGUI CLI
#   3. Parse the JSON: find spawner actors, resolve RootComponent, read RelativeLocation
#   4. Write Game/Parsed/spawns.json
#
# Usage: powershell -ExecutionPolicy Bypass -File pipeline\parse_spawns.ps1

$MapsDir   = "C:\Program Files\Epic Games\SoulMaskModkit\Projects\WS\Content\Maps"
$UassetGui = "D:\UAssetGUI.exe"
$EngineVer = "VER_UE4_27"
$ScriptDir = Split-Path $MyInvocation.MyCommand.Path
$OutFile   = Join-Path $ScriptDir "..\Game\Parsed\spawns.json"
$OutFile   = [System.IO.Path]::GetFullPath($OutFile)

$SpawnerPatterns = @("ShuaGuaiQi", "SGQ")
$SpawnerClassPatterns = @("ShuaGuaiQi", "SGQ", "ShuaGuai")

# ── Helper: search bytes for a UTF-8 string ──────────────────────────────────
function Test-BytesContain($bytes, $pattern) {
    $enc     = [System.Text.Encoding]::UTF8
    $patBytes = $enc.GetBytes($pattern)
    $pLen    = $patBytes.Length
    $bLen    = $bytes.Length - $pLen
    for ($i = 0; $i -le $bLen; $i++) {
        if ($bytes[$i] -eq $patBytes[0]) {
            $ok = $true
            for ($j = 1; $j -lt $pLen; $j++) {
                if ($bytes[$i+$j] -ne $patBytes[$j]) { $ok = $false; break }
            }
            if ($ok) { return $true }
        }
    }
    return $false
}

# ── Helper: get a named property from a UAssetAPI Data array ─────────────────
function Get-Prop($dataArray, $name) {
    foreach ($p in $dataArray) {
        if ($p.Name -eq $name) { return $p }
    }
    return $null
}

# ── Helper: extract X/Y/Z from a RelativeLocation struct property ────────────
# UAssetAPI serializes Vector structs as:
#   locProp.Value = [ VectorPropertyData { Value = FVector { X, Y, Z } } ]
function Resolve-Vector($locProp) {
    if (-not $locProp) { return $null }
    $arr = $locProp.Value
    if ($arr -is [System.Collections.IEnumerable] -and $arr.Count -gt 0) {
        $fvec = $arr[0].Value   # FVector object
        if ($fvec -and $null -ne $fvec.X -and $null -ne $fvec.Y -and $null -ne $fvec.Z) {
            return @([float]$fvec.X, [float]$fvec.Y, [float]$fvec.Z)
        }
    }
    return $null
}

# ── Helper: resolve an import index to its ObjectName ────────────────────────
function Resolve-Import($imports, $idx) {
    if ($idx -ge 0) { return $null }
    $pos = (-$idx) - 1
    if ($pos -lt $imports.Count) { return $imports[$pos] }
    return $null
}

# ── Step 1: Binary scan ───────────────────────────────────────────────────────
Write-Host "Scanning .umap files in $MapsDir ..."
$allUmaps = Get-ChildItem $MapsDir -Recurse -Filter "*.umap"
Write-Host "  Total: $($allUmaps.Count) files"

$matchingUmaps = @()
$i = 0
foreach ($umap in $allUmaps) {
    $i++
    $sizeMB = [math]::Round($umap.Length / 1MB, 1)
    if ($i % 20 -eq 0) { Write-Host "  Scanning $i/$($allUmaps.Count) ..." }

    $bytes = [System.IO.File]::ReadAllBytes($umap.FullName)
    $found = $false
    foreach ($pat in $SpawnerPatterns) {
        if (Test-BytesContain $bytes $pat) { $found = $true; break }
    }
    if ($found) {
        $rel = $umap.FullName.Substring($MapsDir.Length + 1)
        Write-Host "  FOUND ($sizeMB MB): $rel"
        $matchingUmaps += $umap
    }
}

Write-Host ""
Write-Host "$($matchingUmaps.Count) files contain spawner refs."
if ($matchingUmaps.Count -eq 0) { Write-Host "Nothing to do."; exit 1 }

# ── Steps 2+3: Export + Parse ─────────────────────────────────────────────────
$allSpawns = [System.Collections.Generic.List[hashtable]]::new()
$errors    = @()
$tmpDir    = [System.IO.Path]::GetTempPath()
$fileIdx   = 0

foreach ($umap in $matchingUmaps) {
    $fileIdx++
    $mapName = [System.IO.Path]::GetFileNameWithoutExtension($umap.Name)
    $mapRel  = $umap.FullName.Substring($MapsDir.Length + 1)
    $sizeMB  = [math]::Round($umap.Length / 1MB, 1)
    $jsonOut = Join-Path $tmpDir ("spawns_tmp_$mapName.json")

    Write-Host "[$fileIdx/$($matchingUmaps.Count)] Exporting $mapName ($sizeMB MB)..."

    if (Test-Path $jsonOut) { Remove-Item $jsonOut }
    $proc = Start-Process -FilePath $UassetGui `
        -ArgumentList "tojson", "`"$($umap.FullName)`"", "`"$jsonOut`"", $EngineVer `
        -Wait -PassThru -NoNewWindow

    if (-not (Test-Path $jsonOut)) {
        Write-Host "  SKIP: export failed (exit $($proc.ExitCode))"
        $errors += $mapRel
        continue
    }

    $jsonSizeMB = [math]::Round((Get-Item $jsonOut).Length / 1MB, 1)
    Write-Host "  Parsing JSON ($jsonSizeMB MB)..."

    try {
        $data    = Get-Content $jsonOut -Raw | ConvertFrom-Json
        $imports = $data.Imports
        $exports = $data.Exports

        # Build 1-based export index map
        $expMap = @{}
        for ($ei = 0; $ei -lt $exports.Count; $ei++) {
            $expMap[$ei + 1] = $exports[$ei]
        }

        $spawnerCount = 0
        foreach ($exp in $exports) {
            # Resolve class name
            $classIdx = $exp.ClassIndex
            $imp      = Resolve-Import $imports $classIdx
            $className = if ($imp) { $imp.ObjectName } else { "" }

            $isSpawner = $false
            foreach ($pat in $SpawnerClassPatterns) {
                if ($className -match $pat) { $isSpawner = $true; break }
            }
            if (-not $isSpawner) { continue }

            $actorName = $exp.ObjectName
            $expData   = $exp.Data

            $posX = $posY = $posZ = $null
            $yaw  = $null

            # Strategy A: actor.RootComponent -> SceneComponent.RelativeLocation
            $rootProp = Get-Prop $expData "RootComponent"
            if ($rootProp -and $rootProp.Value -is [int] -and $rootProp.Value -gt 0) {
                $rootExp = $expMap[$rootProp.Value]
                if ($rootExp) {
                    $locProp = Get-Prop $rootExp.Data "RelativeLocation"
                    if ($locProp) {
                        $vec = Resolve-Vector $locProp
                        if ($vec) { $posX = $vec[0]; $posY = $vec[1]; $posZ = $vec[2] }
                    }
                    $rotProp = Get-Prop $rootExp.Data "RelativeRotation"
                    if ($rotProp -and ($rotProp.Value -is [System.Collections.IEnumerable])) {
                        foreach ($sub in $rotProp.Value) {
                            if ($sub.Name -eq "Yaw") { $yaw = [float]$sub.Value }
                        }
                    }
                }
            }

            # Strategy B: GuDingDianSCGTransList[0].Translation (FVector inside Transform struct)
            if ($null -eq $posX) {
                $gdProp = Get-Prop $expData "GuDingDianSCGTransList"
                if ($gdProp -and ($gdProp.Value -is [System.Collections.IEnumerable]) -and $gdProp.Value.Count -gt 0) {
                    $firstT = $gdProp.Value[0]
                    if ($firstT.Value -is [System.Collections.IEnumerable]) {
                        foreach ($sub in $firstT.Value) {
                            if ($sub.Name -eq "Translation") {
                                # Translation is a VectorPropertyData with .Value = FVector
                                $fvec = if ($sub.Value -is [System.Collections.IEnumerable]) { $sub.Value[0].Value } else { $sub.Value }
                                if ($fvec -and $null -ne $fvec.X) {
                                    $posX = [float]$fvec.X; $posY = [float]$fvec.Y; $posZ = [float]$fvec.Z
                                }
                                break
                            }
                        }
                    }
                }
            }

            $spawn = @{
                map           = $mapName
                map_path      = $mapRel
                spawner_class = $className
                actor_name    = $actorName
                pos_x         = $posX
                pos_y         = $posY
                pos_z         = $posZ
            }
            if ($null -ne $yaw) { $spawn["rotation_yaw"] = $yaw }
            $allSpawns.Add($spawn)
            $spawnerCount++
        }

        Write-Host "  -> $spawnerCount spawner actors"
    } catch {
        Write-Host "  ERROR parsing JSON: $_"
        $errors += $mapRel
    } finally {
        if (Test-Path $jsonOut) { Remove-Item $jsonOut }
    }
}

# ── Write output ──────────────────────────────────────────────────────────────
$outDir = Split-Path $OutFile
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

$allSpawns | ConvertTo-Json -Depth 3 | Set-Content $OutFile -Encoding UTF8
Write-Host ""
Write-Host "="*60
Write-Host "Total spawns  : $($allSpawns.Count)"
Write-Host "Maps OK       : $($matchingUmaps.Count - $errors.Count)/$($matchingUmaps.Count)"
if ($errors.Count -gt 0) {
    Write-Host "Failures      : $($errors.Count)"
    $errors | ForEach-Object { Write-Host "  $_" }
}

# Per-class breakdown
$classCounts = $allSpawns | Group-Object { $_["spawner_class"] } | Sort-Object Count -Descending
Write-Host "`nTop spawner classes:"
$classCounts | Select-Object -First 20 | ForEach-Object { Write-Host "  $($_.Count.ToString().PadLeft(5))  $($_.Name)" }

# Per-map breakdown
$mapCounts = $allSpawns | Group-Object { $_["map"] } | Sort-Object Count -Descending
Write-Host "`nPer-map breakdown:"
$mapCounts | ForEach-Object { Write-Host "  $($_.Count.ToString().PadLeft(5))  $($_.Name)" }

# Coord coverage
$withCoords = ($allSpawns | Where-Object { $null -ne $_["pos_x"] }).Count
Write-Host "`nWith coordinates: $withCoords/$($allSpawns.Count)"
Write-Host "Output: $OutFile"
