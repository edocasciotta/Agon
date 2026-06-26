import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/installation',
        'getting-started/onboarding',
        'getting-started/client-setup'
      ]
    },
    {
      type: 'category',
      label: 'For Studio Managers',
      items: [
        'studio-manager/classes',
        'studio-manager/clients',
        'studio-manager/memberships',
        'studio-manager/payments',
        'studio-manager/check-in',
        'studio-manager/reports',
        'studio-manager/settings',
        'studio-manager/ai-support'
      ]
    },
    {
      type: 'category',
      label: 'For Clients',
      items: [
        'clients/booking-a-class',
        'clients/check-in',
        'clients/memberships',
        'clients/notifications'
      ]
    },
    {
      type: 'category',
      label: 'Migration',
      items: [
        'migration/overview',
        'migration/column-mapping'
      ]
    },
    {
      type: 'category',
      label: 'GDPR',
      items: [
        'gdpr/studio-manager-guide'
      ]
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/overview'
      ]
    }
  ]
}

export default sidebars
