[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$BaseUrl,
 [Parameter(Mandatory=$true)][string]$CatalogPath,
 [string]$TokenFile,
 [string]$PreviewBypassFile,
 [switch]$SaveToken,
 [switch]$Once
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$uri=[Uri]$BaseUrl
if($uri.Scheme -ne 'https' -or $uri.UserInfo -or $uri.Query -or $uri.Fragment -or $uri.AbsolutePath -ne '/') { throw 'Use the exact approved HTTPS application origin, without path or query.' }
$endpoint=$uri.GetLeftPart([UriPartial]::Authority)+'/api/desktop-agent'
$catalog=Get-Content -LiteralPath $CatalogPath -Raw | ConvertFrom-Json
if($catalog.protocol -ne 1){throw 'Unsupported local catalog protocol.'}
if($SaveToken -and -not $TokenFile){throw 'Specify TokenFile when saving a token.'}
if($SaveToken){
 $secure=Read-Host 'Agent token' -AsSecureString
 $secure | ConvertFrom-SecureString | Set-Content -LiteralPath $TokenFile -Encoding ASCII
}elseif($TokenFile){$secure=Get-Content -LiteralPath $TokenFile | ConvertTo-SecureString}
else{$secure=Read-Host 'Agent token' -AsSecureString}
function Reveal([Security.SecureString]$s){
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
 try{return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
 finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
}
$token=Reveal $secure
if($token -cnotmatch '^[a-f0-9]{64}$'){throw 'Invalid token format.'}
$headers=@{Authorization=('Bearer '+$token)}
if($PreviewBypassFile){
 # Optional Vercel protection bypass, provided by authorized deployment owner.
 # Local DPAPI-encrypted SecureString file, never Git or command line secret.
 $bypass=Reveal (Get-Content -LiteralPath $PreviewBypassFile | ConvertTo-SecureString)
 $headers['x-vercel-protection-bypass']=$bypass
}
function Send-Request($payload){
 $payload.protocol=1
 $json=ConvertTo-Json -InputObject $payload -Depth 15 -Compress
 Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json)) -TimeoutSec 45 -MaximumRedirection 0
}
function Send-Result($payload){
 for($i=0;$i -lt 3;$i++){
  try{return Send-Request $payload}
  catch{if($i -eq 2){throw};Start-Sleep -Seconds (2+3*$i)}
 }
}
$workRoot=Join-Path $env:LOCALAPPDATA 'SIGActiva\DesktopAgent'
New-Item -Path $workRoot -ItemType Directory -Force | Out-Null
Write-Host "SIG Activa Desktop Agent. Local allowlist only. Press Ctrl+C to stop."
do{
 $job=$null
 try{
  $poll=Send-Request @{action='poll'}
  $job=$poll.job
  if($null -ne $job){
   if([string]$job.id -notmatch '^[a-f0-9-]{36}$'){throw 'Invalid job ID'}
   $jobDir=Join-Path $workRoot ([string]$job.id)
   New-Item -Path $jobDir -ItemType Directory -Force | Out-Null
   $requestPath=Join-Path $jobDir 'request.json'
   $resultPath=Join-Path $jobDir 'result.json'
   try{
    # The server supplies a registered job type and data, never executable commands.
    $entry=$catalog.handlers.PSObject.Properties[[string]$job.kind]
    if($null -eq $entry){throw 'INVALID_OUTPUT'}
    $handler=$entry.Value
    $params=$job.parameters
    if($job.kind -eq 'HPP_EXTRACT' -and ([int]$params.year -lt 2000 -or [int]$params.year -gt 2100 -or [int]$params.period -lt 1 -or [int]$params.period -gt 12)){throw 'INVALID_OUTPUT'}
    if($handler.mode -eq 'Synthetic' -and $job.kind -eq 'HPP_EXTRACT'){
     # Deterministic mock values; server permanently blocks synthetic publishing.
     $rows=@($params.scope | ForEach-Object {@{code=[string]$_.code;name=[string]$_.name;plant=[string]$_.plant;cogm='1000.125';deliveryQty='10'}})
     $result=@{year=[int]$params.year;period=[int]$params.period;mode='SYNTHETIC';rows=$rows}
    }elseif($handler.mode -eq 'LocalAdapter'){
     # Local wrapper launches the existing extraction engine; no remote commands.
     $AdapterPath=(Resolve-Path -LiteralPath ([string]$handler.adapterPath)).Path
     if([IO.Path]::GetExtension($AdapterPath) -ne '.ps1'){throw 'INVALID_OUTPUT'}
     $params | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $requestPath -Encoding UTF8
     if(Test-Path -LiteralPath $resultPath){Remove-Item -LiteralPath $resultPath -Force}
     $argsList=@('-NoProfile','-NonInteractive','-File',('"'+$AdapterPath+'"'),'-RequestPath',('"'+$requestPath+'"'),'-ResultPath',('"'+$resultPath+'"'))
     $p=Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $argsList -PassThru -WindowStyle Hidden
     if(-not $p.WaitForExit(25*60*1000)){try{$p.Kill()}catch{};throw 'SCRIPT_TIMEOUT'}
     if($p.ExitCode -ne 0){throw 'SCRIPT_FAILED'}
     if(-not (Test-Path -LiteralPath $resultPath) -or (Get-Item -LiteralPath $resultPath).Length -gt 3MB){throw 'INVALID_OUTPUT'}
     $result=Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
     if($job.kind -eq 'HPP_EXTRACT' -and ($result.mode -ne 'SAP_SCRIPT' -or $result.year -ne $params.year -or $result.period -ne $params.period)){throw 'INVALID_OUTPUT'}
    }else{throw 'INVALID_OUTPUT'}
   }catch{
    $code='LOCAL_ERROR'
    if($_.Exception.Message -in @('SCRIPT_TIMEOUT','SCRIPT_FAILED','INVALID_OUTPUT')){$code=$_.Exception.Message}
    try{Send-Request @{action='fail';kind=$job.kind;jobId=$job.id;lease=$job.lease;code=$code}|Out-Null}catch{Write-Warning 'Failure status not delivered; lease will expire.'}
    Write-Warning "Extraction failed: $code"
    $result=$null
   }
   if($null -ne $result){
    # Do not turn a network ambiguity into a failed job; retry exact result.
    try{$ack=Send-Result @{action='complete';kind=$job.kind;jobId=$job.id;lease=$job.lease;result=$result};Write-Host "Job $($job.id): $($ack.status)"}
    catch{Write-Warning 'Result delivery not confirmed; review server status or wait for lease expiry.'}
   }
  }
 }catch{Write-Warning 'Polling or job setup failed. Check connection, token and deployment protection.'}
 if(-not $Once){Start-Sleep -Seconds 15}
}while(-not $Once)
