/**
 * Audit Log Page — Enterprise compliance & security monitoring
 *
 * Displays a filterable, searchable table of all platform activity events.
 * Supports filtering by user, action, resource type, status, and date range.
 */

import { useState, useEffect, useCallback } from 'react'
import { Shield, Search, Filter, RefreshCw, Download, Clock, User, Activity, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import axios from 'axios'
import { API_BASE_URL } from '@/lib/api-config'

interface AuditEvent {
  id: string
  timestamp: string
  user_id: string
  user_email: string | null
  action: string
  resource_type: string
  resource_id: string | null
  details: Record<string, any>
  ip_address: string | null
  status: string
  org_id: string | null
}

interface AuditSummary {
  total_events: number
  failures: number
  active_users: number
  period_hours: number
  actions: Record<string, number>
  resources: Record<string, number>
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  login: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  logout: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  execute: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  scan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  export: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  failure: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  denied: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [summary, setSummary] = useState<AuditSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const pageSize = 50

  // Filters
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [resourceFilter, setResourceFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = {
        limit: pageSize,
        offset: page * pageSize,
      }
      if (search) params.search = search
      if (actionFilter !== 'all') params.action = actionFilter
      if (resourceFilter !== 'all') params.resource_type = resourceFilter
      if (statusFilter !== 'all') params.status = statusFilter

      const [logsRes, summaryRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/audit/logs`, { params }),
        axios.get(`${API_BASE_URL}/api/audit/summary`, { params: { hours: 24 } }),
      ])

      setEvents(logsRes.data.events || [])
      setTotal(logsRes.data.total || 0)
      setSummary(summaryRes.data)
    } catch (err) {
      console.error('[AuditLog] Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }, [page, search, actionFilter, resourceFilter, statusFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts)
      return d.toLocaleString()
    } catch {
      return ts
    }
  }

  const exportCSV = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Resource', 'Resource ID', 'Status', 'IP', 'Details']
    const rows = events.map(e => [
      e.timestamp, e.user_email || e.user_id, e.action, e.resource_type,
      e.resource_id || '', e.status, e.ip_address || '', JSON.stringify(e.details),
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Audit Log
          </h1>
          <p className="text-muted-foreground mt-1">
            Enterprise activity monitoring and compliance trail
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={events.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Events (24h)</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summary.total_events}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Active Users</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summary.active_users}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Failures</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summary.failures}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">Total Logged</span>
              </div>
              <p className="text-2xl font-bold mt-1">{total}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0) }}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-3.5 w-3.5 mr-1" />
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="execute">Execute</SelectItem>
                <SelectItem value="scan">Scan</SelectItem>
                <SelectItem value="export">Export</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resourceFilter} onValueChange={(v) => { setResourceFilter(v); setPage(0) }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Resource" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="test_case">Test Cases</SelectItem>
                <SelectItem value="test_run">Test Runs</SelectItem>
                <SelectItem value="api_request">API Requests</SelectItem>
                <SelectItem value="accessibility_scan">A11y Scans</SelectItem>
                <SelectItem value="user">Users</SelectItem>
                <SelectItem value="settings">Settings</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failure</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Activity Events</CardTitle>
          <CardDescription>
            {total} events found {search && `matching "${search}"`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No audit events found</p>
              <p className="text-sm mt-1">Activity will appear here as users interact with the platform</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3 font-medium text-muted-foreground">Time</th>
                    <th className="py-2 pr-3 font-medium text-muted-foreground">User</th>
                    <th className="py-2 pr-3 font-medium text-muted-foreground">Action</th>
                    <th className="py-2 pr-3 font-medium text-muted-foreground">Resource</th>
                    <th className="py-2 pr-3 font-medium text-muted-foreground">Status</th>
                    <th className="py-2 pr-3 font-medium text-muted-foreground">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground text-xs">
                        {formatTimestamp(event.timestamp)}
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <span className="font-medium">{event.user_email || event.user_id}</span>
                        {event.ip_address && (
                          <span className="text-xs text-muted-foreground ml-1">({event.ip_address})</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="secondary" className={ACTION_COLORS[event.action] || ''}>
                          {event.action}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span>{event.resource_type.replace(/_/g, ' ')}</span>
                        {event.resource_id && (
                          <span className="text-xs text-muted-foreground ml-1 font-mono">
                            #{event.resource_id.slice(0, 8)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="secondary" className={STATUS_COLORS[event.status] || ''}>
                          {event.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 max-w-[200px] truncate text-xs text-muted-foreground">
                        {Object.keys(event.details).length > 0
                          ? JSON.stringify(event.details).slice(0, 80)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
