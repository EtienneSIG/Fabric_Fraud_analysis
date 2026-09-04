terraform {
  required_version = ">= 1.6.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    fabric = {
      source  = "microsoft/fabric"
      version = "~> 1.13"
    }
    azapi = {
      source  = "Azure/azapi"
      version = "~> 2.0"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id                 = var.subscription_id
  resource_provider_registrations = "none"
  storage_use_azuread             = true
}

provider "azuread" {}

# Fabric-plane provider (workspace creation). Uses the same Azure CLI login.
provider "fabric" {}

# azapi provider for the Foundry PROJECT (Microsoft.CognitiveServices/accounts/projects),
# not yet exposed as a first-class azurerm resource for the new Agent Service.
provider "azapi" {}
