# HashiCorp Vault policy — Ethical Sales Oracle production
#
# Apply with:
#   vault policy write eso-production infra/vault/eso-policy.hcl
#
# This policy is attached to the Kubernetes auth role "eso-production",
# which is used by the External Secrets Operator to pull secrets.

# Database credentials
path "secret/data/eso/production/database" {
  capabilities = ["read"]
}

# Auth0 credentials
path "secret/data/eso/production/auth0" {
  capabilities = ["read"]
}

# Anthropic / LLM credentials
path "secret/data/eso/production/llm" {
  capabilities = ["read"]
}

# Kafka SASL credentials
path "secret/data/eso/production/kafka" {
  capabilities = ["read"]
}

# PagerDuty integration keys
path "secret/data/eso/production/pagerduty" {
  capabilities = ["read"]
}

# Deny everything else
path "*" {
  capabilities = ["deny"]
}
