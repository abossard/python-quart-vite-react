# Deploy to Azure - Quick Start Guide

This guide shows you the **quickest ways** to deploy this Quart + React application on Azure.

## 🚀 Quickest Method: Azure Container Apps (Recommended)

Azure Container Apps is the fastest and most modern way to deploy containerized applications. It handles scaling, load balancing, and HTTPS automatically.

### Prerequisites
- Azure CLI installed ([Install here](https://learn.microsoft.com/cli/azure/install-azure-cli))
- Docker installed
- An Azure account with an active subscription

### One-Command Deployment

We've created a script that automates the entire deployment:

```bash
./azure-deploy.sh
```

This script will:
1. Login to Azure (if needed)
2. Create a resource group
3. Create an Azure Container Registry (ACR)
4. Build and push your Docker image
5. Deploy to Azure Container Apps
6. Display your application URL

**Expected time: 5-10 minutes**

### Manual Deployment (Step by Step)

If you prefer to understand each step or customize the deployment:

#### 1. Login to Azure

```bash
az login
```

#### 2. Set variables

```bash
# Customize these values
RESOURCE_GROUP="quart-react-demo-rg"
LOCATION="eastus"
ACR_NAME="quartreactdemo$(date +%s)"  # Must be globally unique
CONTAINER_APP_ENV="quart-react-env"
CONTAINER_APP_NAME="quart-react-app"
```

#### 3. Create resource group

```bash
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION
```

#### 4. Create Azure Container Registry

```bash
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true
```

#### 5. Build and push Docker image

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Build and push image
az acr build \
  --registry $ACR_NAME \
  --image quart-react-demo:latest \
  --file Dockerfile \
  .
```

#### 6. Create Container Apps environment

```bash
az containerapp env create \
  --name $CONTAINER_APP_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION
```

#### 7. Deploy to Container Apps

```bash
# Get ACR credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)
ACR_SERVER="${ACR_NAME}.azurecr.io"

# Deploy container app
az containerapp create \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_APP_ENV \
  --image ${ACR_SERVER}/quart-react-demo:latest \
  --registry-server $ACR_SERVER \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 5001 \
  --ingress external \
  --cpu 0.5 \
  --memory 1.0Gi
```

#### 8. Get your application URL

```bash
az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  -o tsv
```

Your app will be available at: `https://<app-name>.<region>.azurecontainerapps.io`

## 🔧 Alternative Method: Azure App Service (Web App for Containers)

Azure App Service is another good option if you prefer traditional PaaS:

### Quick deployment

```bash
# Set variables
RESOURCE_GROUP="quart-react-demo-rg"
LOCATION="eastus"
APP_SERVICE_PLAN="quart-react-plan"
WEB_APP_NAME="quart-react-demo-$(date +%s)"
ACR_NAME="quartreactdemo$(date +%s)"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create ACR and build image (same as above)
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true
az acr login --name $ACR_NAME
az acr build --registry $ACR_NAME --image quart-react-demo:latest --file Dockerfile .

# Create App Service Plan (Linux)
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --is-linux \
  --sku B1

# Create Web App
ACR_SERVER="${ACR_NAME}.azurecr.io"
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --name $WEB_APP_NAME \
  --deployment-container-image-name ${ACR_SERVER}/quart-react-demo:latest

# Configure ACR credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

az webapp config container set \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --docker-custom-image-name ${ACR_SERVER}/quart-react-demo:latest \
  --docker-registry-server-url https://${ACR_SERVER} \
  --docker-registry-server-user $ACR_USERNAME \
  --docker-registry-server-password $ACR_PASSWORD

# Configure port
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $WEB_APP_NAME \
  --settings WEBSITES_PORT=5001
```

Your app will be available at: `https://<web-app-name>.azurewebsites.net`

## 📦 Using Azure Portal (No CLI Required)

If you prefer a GUI approach:

### Method 1: Deploy to Container Apps via Portal

1. **Login to Azure Portal**: https://portal.azure.com
2. **Create a Container App**:
   - Search for "Container Apps" and click "Create"
   - Select/create a resource group
   - Enter app name and region
   - Click "Next: Container"
3. **Configure Container**:
   - Uncheck "Use quickstart image"
   - For "Image source" select "Docker Hub or other registries"
   - For "Image and tag" enter: `your-dockerhub-username/quart-react-demo:latest`
   - (First push to Docker Hub: `docker build -t your-username/quart-react-demo . && docker push your-username/quart-react-demo`)
   - Set "Target port" to `5001`
4. **Configure Ingress**:
   - Enable "Ingress"
   - Set "Ingress traffic" to "Accepting traffic from anywhere"
   - Set "Target port" to `5001`
5. **Review + Create**: Click through and wait for deployment

### Method 2: Deploy from Docker Hub

1. **Push to Docker Hub first**:
   ```bash
   docker login
   docker build -t yourusername/quart-react-demo:latest .
   docker push yourusername/quart-react-demo:latest
   ```

2. **Deploy in Azure Portal**:
   - Go to Container Apps → Create
   - Use the Docker Hub image: `yourusername/quart-react-demo:latest`
   - Configure ingress on port 5001

## 🔐 Environment Variables (Optional)

If you need to configure Azure OpenAI or other environment variables:

### Container Apps

```bash
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars \
    AZURE_OPENAI_ENDPOINT="your-endpoint" \
    AZURE_OPENAI_API_KEY="your-key" \
    AZURE_OPENAI_DEPLOYMENT="your-deployment" \
    AZURE_OPENAI_API_VERSION="2024-05-01-preview"
```

### App Service

```bash
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $WEB_APP_NAME \
  --settings \
    AZURE_OPENAI_ENDPOINT="your-endpoint" \
    AZURE_OPENAI_API_KEY="your-key" \
    AZURE_OPENAI_DEPLOYMENT="your-deployment" \
    AZURE_OPENAI_API_VERSION="2024-05-01-preview"
```

## 📊 Monitoring and Logs

### View logs in Container Apps

```bash
az containerapp logs show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --follow
```

### View logs in App Service

```bash
az webapp log tail \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP
```

## 💰 Cost Estimates

**Azure Container Apps** (Recommended):
- Free tier: First 180,000 vCPU-seconds, 360,000 GiB-seconds/month free
- Consumption plan: ~$0.000012 per vCPU-second, ~$0.000003 per GiB-second
- **Estimated cost for small app: $5-20/month**

**Azure App Service** (B1 Basic):
- ~$13/month for Basic B1 tier
- Good for consistent, always-on workloads

**Azure Container Registry**:
- Basic tier: $5/month
- Includes 10 GB storage

## 🔄 Continuous Deployment

### GitHub Actions (Recommended)

Create `.github/workflows/azure-deploy.yml`:

```yaml
name: Deploy to Azure Container Apps

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Login to Azure
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}
    
    - name: Build and push to ACR
      run: |
        az acr build \
          --registry ${{ secrets.ACR_NAME }} \
          --image quart-react-demo:${{ github.sha }} \
          --image quart-react-demo:latest \
          --file Dockerfile \
          .
    
    - name: Deploy to Container Apps
      run: |
        az containerapp update \
          --name ${{ secrets.CONTAINER_APP_NAME }} \
          --resource-group ${{ secrets.RESOURCE_GROUP }} \
          --image ${{ secrets.ACR_NAME }}.azurecr.io/quart-react-demo:${{ github.sha }}
```

**Setup**: Add these secrets to your GitHub repository:
- `AZURE_CREDENTIALS` - Service principal JSON
- `ACR_NAME` - Your ACR name
- `CONTAINER_APP_NAME` - Your app name
- `RESOURCE_GROUP` - Your resource group

### Create service principal

```bash
az ad sp create-for-rbac \
  --name "quart-react-demo-sp" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/<resource-group> \
  --sdk-auth
```

Copy the JSON output to GitHub Secrets as `AZURE_CREDENTIALS`.

## 🐛 Troubleshooting

### Container fails to start

Check logs:
```bash
az containerapp logs show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --follow
```

Common issues:
- **Port mismatch**: Ensure Docker exposes 5001 and ingress targets 5001
- **Health check failures**: Container Apps expects the app to respond on the target port
- **Memory limits**: Increase memory if app crashes: `--memory 2.0Gi`

### Image pull errors

```bash
# Verify ACR credentials
az acr credential show --name $ACR_NAME

# Update container app with correct credentials
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --registry-server ${ACR_NAME}.azurecr.io \
  --registry-username <username> \
  --registry-password <password>
```

### App responds with 502/503

- Check if the container is running: `az containerapp show ...`
- Verify the target port matches what Hypercorn binds to (5001)
- Check container logs for startup errors

## 📚 Additional Resources

- [Azure Container Apps Documentation](https://learn.microsoft.com/azure/container-apps/)
- [Azure App Service Documentation](https://learn.microsoft.com/azure/app-service/)
- [Deploying Python Web Apps on Azure](https://learn.microsoft.com/azure/developer/python/)
- [Quart Deployment Guide](https://quart.palletsprojects.com/en/latest/tutorials/deployment.html)

## ✅ Quick Deployment Checklist

- [ ] Install Azure CLI
- [ ] Login to Azure: `az login`
- [ ] Run deployment script: `./azure-deploy.sh`
- [ ] Wait 5-10 minutes
- [ ] Access your app at the provided URL
- [ ] (Optional) Configure environment variables
- [ ] (Optional) Set up GitHub Actions for CI/CD

---

**Need help?** Open an issue or check the [Troubleshooting guide](TROUBLESHOOTING.md).
