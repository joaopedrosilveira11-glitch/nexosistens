import { useMemo, useState } from 'react'
import { dashboardService } from '../services/dashboardService'

export function useDashboardViewModel(defaultFilter = 'mes-atual') {
  const [selectedFilter, setSelectedFilter] = useState(defaultFilter)

  const metrics = useMemo(() => dashboardService.getKpis(selectedFilter), [selectedFilter])

  return {
    selectedFilter,
    setSelectedFilter,
    metrics,
    health: dashboardService.getHealthOverview(),
  }
}
