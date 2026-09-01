# --------------------------------------------------------------------------
# Optional Fabric capacity (billed F SKU) + workspace to host the Rayfin app.
# Gated off by default (enable_fabric_workspace=false) — the capacity is billed
# hourly. capacity_id on the workspace wants the Fabric-plane GUID (data source),
# not the ARM resource id.
# --------------------------------------------------------------------------
resource "azurerm_fabric_capacity" "this" {
  count                  = var.enable_fabric_workspace ? 1 : 0
  name                   = local.names.fabric_capacity
  resource_group_name    = local.resource_group_name
  location               = var.location
  administration_members = [var.fabric_admin_member != "" ? var.fabric_admin_member : data.azurerm_client_config.current.object_id]

  sku {
    name = var.fabric_capacity_sku
    tier = "Fabric"
  }

  tags = var.tags
}

data "fabric_capacity" "this" {
  count        = var.enable_fabric_workspace ? 1 : 0
  display_name = local.names.fabric_capacity
  depends_on   = [azurerm_fabric_capacity.this]
}

resource "fabric_workspace" "this" {
  count        = var.enable_fabric_workspace ? 1 : 0
  display_name = var.fabric_workspace_name
  description  = "Fabric Fraud Intelligence — Rayfin app workspace."
  capacity_id  = data.fabric_capacity.this[0].id
}
