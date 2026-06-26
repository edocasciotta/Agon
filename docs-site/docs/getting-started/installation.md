---
title: Installing Agon
sidebar_label: Installation
---

# Installing Agon

This guide walks you through downloading and installing the Agon desktop application on your computer. Once installed, you'll complete the setup wizard to configure your studio.

## System requirements

| | Minimum |
|---|---|
| **macOS** | macOS 12 Monterey or later |
| **Windows** | Windows 10 (64-bit) or later |
| **Linux** | Ubuntu 20.04 or equivalent (64-bit) |
| **RAM** | 4 GB |
| **Disk space** | 500 MB for the app; extra space for your database and backups |
| **Internet connection** | Required for initial setup and for clients to connect remotely |

## Step 1: Download Agon

Go to the Agon releases page on GitHub and download the installer for your operating system:

- **macOS**: download the `.dmg` file
- **Windows**: download the `.exe` installer
- **Linux**: download the `.AppImage` or `.deb` file

## Step 2: Install the application

**On macOS:**
1. Open the downloaded `.dmg` file.
2. Drag the **Agon** icon into your **Applications** folder.
3. Open Agon from Applications. If macOS says the app cannot be opened because it is from an unidentified developer, go to **System Settings → Privacy & Security** and click **Open Anyway**.

**On Windows:**
1. Run the downloaded `.exe` installer.
2. Follow the on-screen instructions.
3. Agon will be added to your Start menu and desktop.

**On Linux:**
1. If you downloaded the `.AppImage`, make it executable: right-click → Properties → Permissions → Allow executing as program. Then double-click to run.
2. If you downloaded the `.deb`, install it with: `sudo dpkg -i agon_*.deb`

## Step 3: First launch

When you open Agon for the first time, the setup wizard starts automatically.

The wizard walks you through five steps:
1. Enter your studio information
2. Create your manager account
3. Set up internet connectivity (fully automatic)
4. Optionally connect Stripe for online payments
5. Choose a backup location

See [Onboarding Wizard](onboarding) for a complete guide to each step.

## What happens in the background

When Agon starts, it automatically:
- Starts a local server on **port 8000** on your computer
- Establishes a secure Cloudflare Tunnel so clients can connect from anywhere
- Opens and manages your local database (your data stays on your machine)

You do not need to configure any of this manually.

## Updating Agon

Agon checks for updates automatically when it starts. When an update is available, you will see a notification in the app. Click **Install Update** to download and apply it. The app restarts and resumes where you left off.

## What if something goes wrong?

**The installer fails or the app won't open**
Make sure your operating system meets the minimum requirements. On macOS, check System Settings → Privacy & Security for a blocked app message. On Windows, try running the installer as Administrator.

**Port 8000 is already in use**
Agon uses port 8000 for its local server. If another application on your computer is using this port, Agon will show an error on startup. Close the other application and try again.

**The setup wizard doesn't appear on first launch**
If Agon was previously installed on the same machine, the wizard may not appear because setup was already completed. Reinstall Agon fresh to start over.

## Related pages

- [Onboarding Wizard](onboarding)
- [Setting up the client app](client-setup)
