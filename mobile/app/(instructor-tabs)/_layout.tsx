import { Tabs } from 'expo-router'
import { CalendarDays, User } from 'lucide-react-native'
import { useTheme } from '../../src/theme/ThemeContext'
import { useT } from '../../src/i18n'

export default function InstructorTabsLayout() {
  const { primary } = useTheme()
  const t = useT()
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: primary,
        tabBarInactiveTintColor: '#9CA3AF',
      }}
    >
      <Tabs.Screen
        name="schedule"
        options={{
          title: t('instructorTabs.schedule'),
          tabBarIcon: ({ color, size }) => <CalendarDays size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('instructorTabs.profile'),
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
