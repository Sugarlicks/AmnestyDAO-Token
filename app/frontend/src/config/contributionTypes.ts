/**
 * Contribution Type Configuration
 * Centralized configuration for contribution types including colors, labels, icons, and Quasar colors
 */

export type ContributionType = 'petition' | 'article' | 'event' | 'action' | 'visit' | 'share' | 'scan';

export interface ContributionTypeConfig {
  label: string; // i18n key
  color: string; // Hex color for charts
  quasarColor: string; // Quasar color name for components
  icon: string; // Material icon name
}

/**
 * Contribution type configuration map
 * Colors match the design system used in charts and UI
 */
export const CONTRIBUTION_TYPES: Record<ContributionType, ContributionTypeConfig> = {
  petition: {
    label: 'contributionTypePetition',
    color: '#EE4790',
    quasarColor: 'primary',
    icon: 'how_to_vote'
  },
  article: {
    label: 'contributionTypeArticle',
    color: '#B8C540',
    quasarColor: 'secondary',
    icon: 'article'
  },
  event: {
    label: 'contributionTypeEvent',
    color: '#FFFF00',
    quasarColor: 'accent',
    icon: 'event'
  },
  action: {
    label: 'contributionTypeAction',
    color: '#B8C540',
    quasarColor: 'positive',
    icon: 'check_circle'
  },
  visit: {
    label: 'contributionTypeVisit',
    color: '#009DC1',
    quasarColor: 'info',
    icon: 'visibility'
  },
  share: {
    label: 'contributionTypeShare',
    color: '#FFFF00',
    quasarColor: 'warning',
    icon: 'share'
  },
  scan: {
    label: 'contributionTypeScan',
    color: '#EE4790',
    quasarColor: 'negative',
    icon: 'qr_code_scanner'
  }
};

/**
 * Get contribution type configuration
 */
export function getContributionTypeConfig(type: string): ContributionTypeConfig {
  return CONTRIBUTION_TYPES[type as ContributionType] || {
    label: type,
    color: '#999999',
    quasarColor: 'grey',
    icon: 'help'
  };
}

/**
 * Get contribution type color (hex)
 */
export function getContributionTypeColor(type: string): string {
  return getContributionTypeConfig(type).color;
}

/**
 * Get contribution type Quasar color
 */
export function getContributionTypeQuasarColor(type: string): string {
  return getContributionTypeConfig(type).quasarColor;
}

/**
 * Get contribution type icon
 */
export function getContributionTypeIcon(type: string): string {
  return getContributionTypeConfig(type).icon;
}

/**
 * Get contribution type label (i18n key)
 */
export function getContributionTypeLabel(type: string): string {
  return getContributionTypeConfig(type).label;
}

/**
 * Get all contribution type colors as a record
 */
export function getContributionTypeColors(): Record<string, string> {
  const colors: Record<string, string> = {};
  Object.keys(CONTRIBUTION_TYPES).forEach(type => {
    colors[type] = CONTRIBUTION_TYPES[type as ContributionType].color;
  });
  return colors;
}

/**
 * Get all contribution type Quasar colors as a record
 */
export function getContributionTypeQuasarColors(): Record<string, string> {
  const colors: Record<string, string> = {};
  Object.keys(CONTRIBUTION_TYPES).forEach(type => {
    colors[type] = CONTRIBUTION_TYPES[type as ContributionType].quasarColor;
  });
  return colors;
}

/**
 * Get all contribution type icons as a record
 */
export function getContributionTypeIcons(): Record<string, string> {
  const icons: Record<string, string> = {};
  Object.keys(CONTRIBUTION_TYPES).forEach(type => {
    icons[type] = CONTRIBUTION_TYPES[type as ContributionType].icon;
  });
  return icons;
}

/**
 * Get all contribution type labels as a record (i18n keys)
 * Note: This returns i18n keys, not translated strings
 */
export function getContributionTypeLabels(): Record<string, string> {
  const labels: Record<string, string> = {};
  Object.keys(CONTRIBUTION_TYPES).forEach(type => {
    labels[type] = CONTRIBUTION_TYPES[type as ContributionType].label;
  });
  return labels;
}

