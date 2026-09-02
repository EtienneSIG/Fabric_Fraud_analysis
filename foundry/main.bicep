@description('Globally unique Microsoft Foundry account name.')
param foundryAccountName string = 'esigfoundry'

@description('Microsoft Foundry project name.')
param foundryProjectName string = 'FraudIQ'

@description('Azure region that supports the selected model and Foundry Agent Service.')
param location string = resourceGroup().location

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: foundryAccountName
  location: location
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    allowProjectManagement: true
    customSubDomainName: foundryAccountName
    disableLocalAuth: true
    dynamicThrottlingEnabled: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      ipRules: []
      virtualNetworkRules: []
    }
    restrictOutboundNetworkAccess: false
  }
}

resource foundryProject 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
  parent: foundryAccount
  name: foundryProjectName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    displayName: foundryProjectName
    description: 'Fraud IQ orchestration over governed Fabric evidence and official regulatory sources.'
  }
}

output foundryAccountId string = foundryAccount.id
output foundryProjectId string = foundryProject.id
output foundryProjectEndpoint string = 'https://${foundryAccountName}.services.ai.azure.com/api/projects/${foundryProjectName}'
