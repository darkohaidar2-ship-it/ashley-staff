@echo off
title Deploy to Vercel - Ashley Staff
echo ===================================================
echo   Deploying the latest updates to Vercel...
echo ===================================================
echo.
cmd.exe /c npx.cmd vercel.cmd --prod --scope darko-haidar-s-projects --name ashley-staff --yes
echo.
echo ===================================================
echo   Deployment completed!
echo ===================================================
pause
