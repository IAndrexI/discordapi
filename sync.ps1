Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Discord to Element Desktop 1-Click Sync " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$u = Read-Host "Enter your Matrix username (e.g. andrex)"
$p = Read-Host -AsSecureString "Enter your Matrix password"
$pBstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p)
$pass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($pBstr)

Write-Host "Authenticating with Matrix homeserver..." -ForegroundColor Yellow
try {
    $loginBody = @{
        type = "m.login.password"
        identifier = @{ type = "m.id.user"; user = $u }
        password = $pass
    } | ConvertTo-Json

    $loginRes = Invoke-RestMethod -Uri "https://chat.protutech.vip/_matrix/client/v3/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginRes.access_token
    Write-Host "Matrix authentication successful ($($loginRes.user_id))" -ForegroundColor Green
} catch {
    Write-Host "Matrix login failed. Check username and password." -ForegroundColor Red
    return
}

# Prompt for token or auto-fetch
Write-Host ""
Write-Host "To link Discord, paste your user token (from Discord Network tab -> authorization header):" -ForegroundColor Cyan
$discordToken = Read-Host "Discord Token"

if (-not $discordToken) {
    Write-Host "No token provided. Aborting." -ForegroundColor Red
    return
}

$discordToken = $discordToken.Trim().Trim('"').Trim("'")

Write-Host "Connecting to Discord bridge bot..." -ForegroundColor Yellow
$dmBody = @{
    invite = @("@discordbot:chat.protutech.vip")
    is_direct = $true
    preset = "trusted_private_chat"
} | ConvertTo-Json

$roomRes = Invoke-RestMethod -Uri "https://chat.protutech.vip/_matrix/client/v3/createRoom" -Method Post -Body $dmBody -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" }
$roomId = $roomRes.room_id

Write-Host "Sending login command to bridge..." -ForegroundColor Yellow
$msgBody = @{
    msgtype = "m.text"
    body = "login-token user $discordToken"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://chat.protutech.vip/_matrix/client/v3/rooms/$([uri]::EscapeDataString($roomId))/send/m.room.message" -Method Post -Body $msgBody -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } | Out-Null

Start-Sleep -Seconds 2

Write-Host "Re-inviting to Discord Master Space..." -ForegroundColor Yellow
$spaceBody = @{ msgtype = "m.text"; body = "rejoin-space main" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://chat.protutech.vip/_matrix/client/v3/rooms/$([uri]::EscapeDataString($roomId))/send/m.room.message" -Method Post -Body $spaceBody -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } | Out-Null

Invoke-RestMethod -Uri "https://chat.protutech.vip/_matrix/client/v3/join/%23discord-server:chat.protutech.vip" -Method Post -Body "{}" -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } | Out-Null

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " SETUP COMPLETE! All Discord servers are syncing to Element." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
