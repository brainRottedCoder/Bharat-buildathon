# Uploads the built frontend (frontend/dist, including the prebuilt grids the Lambda
# reads from the same bucket) to the site bucket created by aws/template.yaml, then
# invalidates CloudFront so the new files are served at once.
#
#   powershell -File aws/sync-site.ps1 -BucketName <BucketName output> [-DistributionId <id>]
#
# BucketName and DistributionId are printed by `sam deploy` under Outputs.
param(
  [Parameter(Mandatory = $true)][string]$BucketName,
  [string]$DistributionId
)
$ErrorActionPreference = 'Stop'

$dist = Join-Path $PSScriptRoot '../frontend/dist'
if (-not (Test-Path $dist)) {
  throw "frontend/dist not found - run 'npm run build' at the repo root first."
}
foreach ($grid in @('boundaries/states.bin', 'landcover/india.bin')) {
  if (-not (Test-Path (Join-Path $dist $grid))) {
    throw "frontend/dist/$grid missing - the Lambda cannot classify fires without it. See aws/README.md step 2."
  }
}

aws s3 sync $dist "s3://$BucketName" --delete
if ($DistributionId) {
  aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*" | Out-Null
  Write-Host "CloudFront invalidation created on $DistributionId"
}
Write-Host "Site synced to s3://$BucketName"
