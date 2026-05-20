# Azure Deployment Quick Reference

## TL;DR - Deploy Now

```bash
# One command deployment (5-10 minutes)
./azure-deploy.sh
```

That's it! The script handles everything automatically.

---

## What You Need

1. **Azure CLI** - [Install here](https://learn.microsoft.com/cli/azure/install-azure-cli)
2. **Docker** - [Install here](https://docs.docker.com/get-docker/)
3. **Azure account** - [Create free account](https://azure.microsoft.com/free/)

---

## Manual Deployment (Copy-Paste Commands)

```bash
# Set your preferences
RESOURCE_GROUP="quart-react-demo-rg"
LOCATION="eastus"
ACR_NAME="quartreactdemo$(date +%s)"
APP_NAME="quart-react-app"

# Login to Azure
az login

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create and build in ACR (builds image in cloud)
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true
az acr build --registry $ACR_NAME --image quart-react-demo:latest --file Dockerfile .

# Create Container Apps environment
az containerapp env create --name quart-env --resource-group $RESOURCE_GROUP --location $LOCATION

# Get ACR credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

# Deploy to Container Apps
az containerapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment quart-env \
  --image ${ACR_NAME}.azurecr.io/quart-react-demo:latest \
  --registry-server ${ACR_NAME}.azurecr.io \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 5001 \
  --ingress external \
  --cpu 0.5 \
  --memory 1.0Gi

# Get your app URL
az containerapp show --name $APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv
```

Your app will be live at: `https://<app-name>.<region>.azurecontainerapps.io`

---

## Useful Commands

### View logs
```bash
az containerapp logs show --name $APP_NAME --resource-group $RESOURCE_GROUP --follow
```

### Update after code changes
```bash
az acr build --registry $ACR_NAME --image quart-react-demo:latest --file Dockerfile .
az containerapp update --name $APP_NAME --resource-group $RESOURCE_GROUP --image ${ACR_NAME}.azurecr.io/quart-react-demo:latest
```

### Add environment variables
```bash
az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars \
    AZURE_OPENAI_ENDPOINT="your-endpoint" \
    AZURE_OPENAI_API_KEY="your-key"
```

### Delete everything
```bash
az group delete --name $RESOURCE_GROUP --yes --no-wait
```

---

## Cost Estimate

**Free tier includes:**
- 180,000 vCPU-seconds per month
- 360,000 GiB-seconds per month

**After free tier:**
- ~$5-20/month for small apps
- ~$5/month for Azure Container Registry

---

## GitHub Actions Setup

1. Create a service principal:
```bash
az ad sp create-for-rbac \
  --name "quart-react-sp" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/<resource-group> \
  --sdk-auth
```

2. Add these secrets to your GitHub repository:
   - `AZURE_CREDENTIALS` - Output from command above
   - `ACR_NAME` - Your container registry name
   - `CONTAINER_APP_NAME` - Your app name
   - `RESOURCE_GROUP` - Your resource group name

3. Push to main/master branch - automatic deployment! 🚀

---

## Troubleshooting

**Container won't start?**
- Check logs: `az containerapp logs show --name $APP_NAME --resource-group $RESOURCE_GROUP --follow`
- Verify port 5001 is exposed in Dockerfile

**Image pull errors?**
- Verify ACR credentials: `az acr credential show --name $ACR_NAME`

**502/503 errors?**
- Check if container is running: `az containerapp show --name $APP_NAME --resource-group $RESOURCE_GROUP`
- Verify ingress is on port 5001

---

## 📚 Full Documentation

For detailed explanations, alternatives, and advanced configurations:
👉 **[Complete Azure Deployment Guide](DEPLOY_AZURE.md)**

---

## Alternative: Docker Hub Deployment

If you prefer Docker Hub over Azure Container Registry:

```bash
# Build and push to Docker Hub
docker login
docker build -t yourusername/quart-react-demo:latest .
docker push yourusername/quart-react-demo:latest

# Deploy using Docker Hub image
az containerapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment quart-env \
  --image yourusername/quart-react-demo:latest \
  --target-port 5001 \
  --ingress external \
  --cpu 0.5 \
  --memory 1.0Gi
```

---

**Ready to deploy?** Run: `./azure-deploy.sh` 🚀
