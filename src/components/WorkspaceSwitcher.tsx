import React from 'react'
import { ChevronDown, Building2, FolderOpen, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

export const OrganizationSwitcher: React.FC = () => {
  const { organizations, currentOrg, setCurrentOrg } = useAuth()

  const handleOrgChange = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId)
    if (org) {
      setCurrentOrg(org)
      toast.success(`Switched to ${org.name}`)
    }
  }

  if (!currentOrg) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="truncate">{currentOrg.name}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
          Organizations
        </div>
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleOrgChange(org.id)}
            className="flex items-center gap-2"
          >
            <Building2 className="h-4 w-4" />
            <span className="truncate">{org.name}</span>
            {org.id === currentOrg.id && (
              <Badge variant="secondary" className="ml-auto text-xs">
                Current
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const ProjectSwitcher: React.FC = () => {
  const { projects, currentProject, setCurrentProject } = useAuth()

  const handleProjectChange = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (project) {
      setCurrentProject(project)
      toast.success(`Switched to ${project.name}`)
    }
  }

  if (!currentProject) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            <span className="truncate">{currentProject.name}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
          Projects
        </div>
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onClick={() => handleProjectChange(project.id)}
            className="flex items-center gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            <span className="truncate">{project.name}</span>
            {project.id === currentProject.id && (
              <Badge variant="secondary" className="ml-auto text-xs">
                Current
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Plus className="h-4 w-4 mr-2" />
          Create Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const WorkspaceSwitcher: React.FC = () => {
  const { currentOrg, currentProject } = useAuth()

  return (
    <div className="flex items-center gap-2">
      <OrganizationSwitcher />
      {currentOrg && <ProjectSwitcher />}
    </div>
  )
}
