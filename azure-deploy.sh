#!/bin/bash

# ============================================================================
# Azure Container Apps Deployment Script
# ============================================================================
# This script provides the QUICKEST way to deploy this Quart + React app to Azure
# It handles everything: resource creation, image building, and deployment
#
# Prerequisites:
# - Azure CLI installed (https://learn.microsoft.com/cli/azure/install-azure-cli)
# - Docker installed and running
# - Azure account with active subscription
#
# Usage:
#   ./azure-deploy.sh
#
# The script will:
# 1. Check prerequisites
# 2. Login to Azure (if needed)
# 3. Create resource group
# 4. Create Azure Container Registry (ACR)
# 5. Build and push Docker image
# 6. Deploy to Azure Container Apps
# 7. Display your application URL
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration (customize these if needed)
RESOURCE_GROUP="${RESOURCE_GROUP:-quart-react-demo-rg}"
LOCATION="${LOCATION:-eastus}"
ACR_NAME="${ACR_NAME:-quartreactdemo$(date +%s)}"
CONTAINER_APP_ENV="${CONTAINER_APP_ENV:-quart-react-env}"
CONTAINER_APP_NAME="${CONTAINER_APP_NAME:-quart-react-app}"
IMAGE_NAME="quart-react-demo"

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# ============================================================================
# Prerequisite Checks
# ============================================================================

check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed"
        echo "Please install it from: https://learn.microsoft.com/cli/azure/install-azure-cli"
        exit 1
    fi
    print_success "Azure CLI is installed"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        echo "Please install it from: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker is installed"
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        echo "Please start Docker and try again"
        exit 1
    fi
    print_success "Docker daemon is running"
    
    # Check if Dockerfile exists
    if [ ! -f "Dockerfile" ]; then
        print_error "Dockerfile not found in current directory"
        echo "Please run this script from the repository root"
        exit 1
    fi
    print_success "Dockerfile found"
}

# ============================================================================
# Azure Login
# ============================================================================

azure_login() {
    print_header "Azure Login"
    
    # Check if already logged in
    if az account show &> /dev/null; then
        ACCOUNT_NAME=$(az account show --query name -o tsv)
        print_success "Already logged in to Azure"
        print_info "Current subscription: $ACCOUNT_NAME"
        
        read -p "Continue with this subscription? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Initiating new login..."
            az login
        fi
    else
        print_info "Please login to Azure..."
        az login
    fi
    
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    print_success "Using subscription: $(az account show --query name -o tsv)"
}

# ============================================================================
# Create Resources
# ============================================================================

create_resource_group() {
    print_header "Creating Resource Group"
    
    if az group exists --name $RESOURCE_GROUP | grep -q true; then
        print_warning "Resource group '$RESOURCE_GROUP' already exists"
        read -p "Use existing resource group? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            read -p "Enter a different resource group name: " RESOURCE_GROUP
            create_resource_group
            return
        fi
    else
        print_info "Creating resource group '$RESOURCE_GROUP' in '$LOCATION'..."
        az group create \
            --name $RESOURCE_GROUP \
            --location $LOCATION \
            --output none
        print_success "Resource group created"
    fi
}

create_container_registry() {
    print_header "Creating Azure Container Registry"
    
    # Check if ACR name is available and generate a unique one if needed
    print_info "Checking ACR name availability..."
    ATTEMPT=0
    while ! az acr check-name --name $ACR_NAME --query nameAvailable -o tsv | grep -q true; do
        ATTEMPT=$((ATTEMPT + 1))
        if [ $ATTEMPT -gt 5 ]; then
            print_error "Could not generate unique ACR name after 5 attempts"
            exit 1
        fi
        print_warning "ACR name '$ACR_NAME' is not available (attempt $ATTEMPT)"
        ACR_NAME="quartreactdemo$(date +%s)${RANDOM:0:4}"
        print_info "Trying new name: $ACR_NAME"
        sleep 1  # Small delay to ensure timestamp changes
    done
    
    print_info "Creating container registry '$ACR_NAME'..."
    az acr create \
        --resource-group $RESOURCE_GROUP \
        --name $ACR_NAME \
        --sku Basic \
        --admin-enabled true \
        --output none
    
    print_success "Container registry created"
    
    # Login to ACR
    print_info "Logging in to ACR..."
    az acr login --name $ACR_NAME
    print_success "Logged in to ACR"
}

# ============================================================================
# Build and Push Image
# ============================================================================

build_and_push_image() {
    print_header "Building and Pushing Docker Image"
    
    print_info "This may take 3-5 minutes..."
    print_info "Building image in Azure Container Registry..."
    
    az acr build \
        --registry $ACR_NAME \
        --image $IMAGE_NAME:latest \
        --image $IMAGE_NAME:$(date +%Y%m%d-%H%M%S) \
        --file Dockerfile \
        . \
        --output table
    
    print_success "Image built and pushed successfully"
}

# ============================================================================
# Deploy to Container Apps
# ============================================================================

create_container_app_environment() {
    print_header "Creating Container Apps Environment"
    
    # Check if environment already exists
    if az containerapp env show --name $CONTAINER_APP_ENV --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_warning "Environment '$CONTAINER_APP_ENV' already exists"
    else
        print_info "Creating Container Apps environment..."
        az containerapp env create \
            --name $CONTAINER_APP_ENV \
            --resource-group $RESOURCE_GROUP \
            --location $LOCATION \
            --output none
        print_success "Environment created"
    fi
}

deploy_container_app() {
    print_header "Deploying Container App"
    
    # Get ACR credentials
    ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
    ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)
    ACR_SERVER="${ACR_NAME}.azurecr.io"
    
    # Check if app already exists
    if az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
        print_warning "Container app '$CONTAINER_APP_NAME' already exists"
        print_info "Updating existing container app..."
        
        az containerapp update \
            --name $CONTAINER_APP_NAME \
            --resource-group $RESOURCE_GROUP \
            --image ${ACR_SERVER}/${IMAGE_NAME}:latest \
            --output none
        
        print_success "Container app updated"
    else
        print_info "Creating container app..."
        
        az containerapp create \
            --name $CONTAINER_APP_NAME \
            --resource-group $RESOURCE_GROUP \
            --environment $CONTAINER_APP_ENV \
            --image ${ACR_SERVER}/${IMAGE_NAME}:latest \
            --registry-server $ACR_SERVER \
            --registry-username $ACR_USERNAME \
            --registry-password $ACR_PASSWORD \
            --target-port 5001 \
            --ingress external \
            --cpu 0.5 \
            --memory 1.0Gi \
            --output none
        
        print_success "Container app created"
    fi
}

# ============================================================================
# Display Results
# ============================================================================

display_results() {
    print_header "Deployment Complete! 🎉"
    
    # Get app URL
    APP_URL=$(az containerapp show \
        --name $CONTAINER_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --query properties.configuration.ingress.fqdn \
        -o tsv)
    
    echo -e "${GREEN}Your application is now live!${NC}\n"
    echo -e "📱 Application URL: ${BLUE}https://$APP_URL${NC}"
    echo -e "📦 Resource Group:  ${BLUE}$RESOURCE_GROUP${NC}"
    echo -e "🏗️  ACR Name:        ${BLUE}$ACR_NAME${NC}"
    echo -e "🚀 App Name:        ${BLUE}$CONTAINER_APP_NAME${NC}"
    echo
    print_info "Opening your application in the browser..."
    
    # Try to open in browser (works on most systems)
    if command -v xdg-open &> /dev/null; then
        xdg-open "https://$APP_URL" &> /dev/null || true
    elif command -v open &> /dev/null; then
        open "https://$APP_URL" &> /dev/null || true
    fi
    
    echo
    print_header "Useful Commands"
    echo "View logs:"
    echo "  az containerapp logs show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --follow"
    echo
    echo "Update app after code changes:"
    echo "  az acr build --registry $ACR_NAME --image $IMAGE_NAME:latest ."
    echo "  az containerapp update --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --image ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:latest"
    echo
    echo "Delete all resources:"
    echo "  az group delete --name $RESOURCE_GROUP --yes --no-wait"
    echo
    print_success "Done! Happy coding! 🚀"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║        Azure Container Apps Deployment Script                 ║"
    echo "║        Quart + React Demo Application                         ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    check_prerequisites
    azure_login
    create_resource_group
    create_container_registry
    build_and_push_image
    create_container_app_environment
    deploy_container_app
    display_results
}

# Run main function
main
