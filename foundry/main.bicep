@description('Globally unique Microsoft Foundry account name.')
param foundryAccountName string = 'esigfoundry'

@description('Microsoft Foundry project name.')
param foundryProjectName string = 'FraudIQ'

@description('Azure region that supports the selected model and Foundry Agent Service.')
param location string = resourceGroup().location

@description('Provision the Key Vault that stores the Web IQ connection secret (conn-web-iq).')
param deployKeyVault bool = true

@description('Key Vault name. Holds the Web IQ API key secret; nothing else is stored here.')
param keyVaultName string = 'kv-esigfoundry'

@description('Optional Entra object id to grant Key Vault Secrets Officer, so it can set the Web IQ secret. Leave empty to assign roles out of band.')
param keyVaultAdminPrincipalId string = ''

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

// Holds the Web IQ (regulatory MCP) API key out of Terraform/bicep state; deploy_foundry.ps1
// reads the secret at deploy time and embeds it in the conn-web-iq Foundry connection.
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = if (deployKeyVault) {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: 'Enabled'
  }
}

resource keyVaultAdminRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployKeyVault && !empty(keyVaultAdminPrincipalId)) {
  name: guid(keyVault.id, keyVaultAdminPrincipalId, 'Key Vault Secrets Officer')
  scope: keyVault
  properties: {
    // Key Vault Secrets Officer
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7')
    principalId: keyVaultAdminPrincipalId
    principalType: 'User'
  }
}

output foundryAccountId string = foundryAccount.id
output foundryProjectId string = foundryProject.id
output foundryProjectEndpoint string = 'https://${foundryAccountName}.services.ai.azure.com/api/projects/${foundryProjectName}'
#disable-next-line BCP318
output keyVaultName string = deployKeyVault ? keyVault.name : ''
#disable-next-line BCP318
output keyVaultUri string = deployKeyVault ? keyVault.properties.vaultUri : ''
