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
        'studio-manager/appointments',
        'studio-manager/clients',
        'studio-manager/memberships',
        'studio-manager/payments',
        'studio-manager/check-in',
        'studio-manager/reports',
        'studio-manager/settings',
        'studio-manager/promo-codes',
        'studio-manager/tags',
        'studio-manager/gift-cards',
        'studio-manager/sms-messaging',
        'studio-manager/calendar-sync',
        'studio-manager/waivers',
        'studio-manager/ai-support',
        'studio-manager/ai-actions'
      ]
    },
    {
      type: 'category',
      label: 'For Clients',
      items: [
        'clients/booking-a-class',
        'clients/appointments',
        'clients/check-in',
        'clients/memberships',
        'clients/calendar-sync',
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
        'api/overview',
        'api/database-schema',
        {
          type: 'category',
          label: 'Endpoints',
          items: [
            'api/endpoints/auth',
            'api/endpoints/studio',
            'api/endpoints/clients',
            'api/endpoints/instructors',
            'api/endpoints/class-templates',
            'api/endpoints/classes',
            'api/endpoints/bookings',
            'api/endpoints/appointment-services',
            'api/endpoints/instructor-availability',
            'api/endpoints/appointments',
            'api/endpoints/calendar-sync',
            'api/endpoints/checkins',
            'api/endpoints/membership-types',
            'api/endpoints/memberships',
            'api/endpoints/payments',
            'api/endpoints/promo-codes',
            'api/endpoints/gift-cards',
            'api/endpoints/stripe-billing',
            'api/endpoints/notifications',
            'api/endpoints/reports',
            'api/endpoints/gdpr',
            'api/endpoints/migration',
            'api/endpoints/support',
            'api/endpoints/email-settings',
            'api/endpoints/email-templates',
            'api/endpoints/email-events',
            'api/endpoints/sms-settings',
            'api/endpoints/sms-templates',
            'api/endpoints/sms-events',
            'api/endpoints/sms-send',
            'api/endpoints/smart-lists',
            'api/endpoints/locations',
            'api/endpoints/tags',
            'api/endpoints/waivers',
            'api/endpoints/agent',
            'api/endpoints/misc'
          ]
        }
      ]
    },
    'glossary'
  ]
}

export default sidebars
