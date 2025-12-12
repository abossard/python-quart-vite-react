# Azure Deployment - Getting Started

Welcome! This guide helps you deploy your Quart + React application to Azure in the quickest way possible.

## 🎯 Choose Your Path

### Path 1: Fully Automated (Recommended) ⚡
**Time: 5-10 minutes**

Just run one command and everything is done automatically:

```bash
./azure-deploy.sh
```

The script will:
- ✓ Check your system has everything needed
- ✓ Login to Azure
- ✓ Create all required Azure resources
- ✓ Build and deploy your application
- ✓ Give you the live URL

**Requirements:**
- Azure CLI ([install](https://learn.microsoft.com/cli/azure/install-azure-cli))
- Docker ([install](https://docs.docker.com/get-docker/))
- Azure account ([create free](https://azure.microsoft.com/free/))

### Path 2: Manual Step-by-Step 📖
**Time: 10-15 minutes**

Follow the detailed guide to understand every step:

👉 **[Complete Azure Deployment Guide](DEPLOY_AZURE.md)**

Includes:
- Azure Container Apps deployment (modern & recommended)
- Azure App Service deployment (traditional)
- Azure Portal deployment (GUI)
- Environment variables configuration
- Monitoring and troubleshooting

### Path 3: Quick Copy-Paste 📋
**Time: 8-12 minutes**

Just copy and paste commands from:

👉 **[Azure Quick Reference](AZURE_QUICK_REFERENCE.md)**

Perfect if you know what you're doing.

### Path 4: GitHub Actions (CI/CD) 🔄
**Time: 15-20 minutes (one-time setup)**

Automatic deployment on every git push:

1. Deploy once using Path 1 or 2
2. Configure GitHub secrets
3. Push code → automatic deployment!

Details in: **[Complete Azure Deployment Guide - CI/CD Section](DEPLOY_AZURE.md#-continuous-deployment)**

---

## 📊 Quick Comparison

| Method | Time | Difficulty | Best For |
|--------|------|------------|----------|
| `./azure-deploy.sh` | 5-10 min | ⭐ Easy | Everyone |
| Manual CLI | 10-15 min | ⭐⭐ Medium | Learning |
| Azure Portal | 12-18 min | ⭐⭐ Medium | GUI lovers |
| GitHub Actions | 15-20 min | ⭐⭐⭐ Advanced | Production |

---

## 💰 Cost

**Free tier includes:**
- 180,000 vCPU-seconds/month
- 360,000 GiB-seconds/month

**Most small apps run on free tier!**

After free tier: ~$5-20/month for typical usage.

Full details: [Pricing breakdown](DEPLOY_AZURE.md#-cost-estimates)

---

## 🚀 Ready to Deploy?

### For your first deployment:

```bash
# Run the automated script
./azure-deploy.sh
```

### Already deployed? Update with:

```bash
# Quick update command
az acr build --registry <your-acr-name> --image quart-react-demo:latest --file Dockerfile .
az containerapp update --name <your-app-name> --resource-group <your-rg> --image <your-acr>.azurecr.io/quart-react-demo:latest
```

---

## 📚 Documentation Tree

```
docs/
├── DEPLOY_AZURE.md           ← Complete deployment guide (all methods)
├── AZURE_QUICK_REFERENCE.md  ← Quick commands & troubleshooting
└── GETTING_STARTED_AZURE.md  ← This file (you are here!)

Root:
├── azure-deploy.sh            ← One-command deployment script
└── .github/workflows/
    └── azure-deploy.yml       ← CI/CD automation
```

---

## ❓ FAQ

**Q: Do I need to know Azure to deploy?**
A: No! Just run `./azure-deploy.sh` and it handles everything.

**Q: Will this cost money?**
A: Free tier covers small apps. You'll see costs before any charges.

**Q: Can I deploy to my existing Azure subscription?**
A: Yes! The script uses your current Azure login.

**Q: What if something goes wrong?**
A: Check [Troubleshooting Guide](DEPLOY_AZURE.md#-troubleshooting)

**Q: How do I update my deployed app?**
A: Re-run `./azure-deploy.sh` or set up GitHub Actions for automatic updates.

**Q: Can I customize the deployment?**
A: Yes! Edit variables at the top of `azure-deploy.sh` or follow the manual guide.

---

## 🆘 Need Help?

1. Check [Troubleshooting Guide](DEPLOY_AZURE.md#-troubleshooting)
2. Review [Azure Quick Reference](AZURE_QUICK_REFERENCE.md)
3. Open an issue on GitHub

---

## ✅ Quick Checklist

Before deploying, make sure you have:

- [ ] Azure CLI installed (`az --version`)
- [ ] Docker installed and running (`docker --version`)
- [ ] Azure account (free tier is fine)
- [ ] You're in the repository root directory
- [ ] You've run `az login` at least once

Then run: `./azure-deploy.sh`

---

**Ready?** → `./azure-deploy.sh` 🚀
