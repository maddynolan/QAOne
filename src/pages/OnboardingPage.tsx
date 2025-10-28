import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, FolderOpen, Users, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { OrganizationService, ProjectService } from '@/lib/supabase-service'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

export const OnboardingPage: React.FC = () => {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [orgData, setOrgData] = useState({
    name: '',
    description: ''
  })
  const [projectData, setProjectData] = useState({
    name: '',
    description: ''
  })

  const { refreshData, currentOrg } = useAuth()
  const navigate = useNavigate()

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await OrganizationService.createOrganization({
        name: orgData.name,
        slug: orgData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        description: orgData.description
      })
      
      await refreshData()
      setStep(2)
      toast.success('Organization created successfully!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!currentOrg) throw new Error('No organization selected')

      await ProjectService.createProject({
        org_id: currentOrg.id,
        name: projectData.name,
        slug: projectData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        description: projectData.description
      })
      
      await refreshData()
      navigate('/')
      toast.success('Project created successfully!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    {
      number: 1,
      title: 'Create Organization',
      description: 'Set up your organization to get started',
      icon: Building2
    },
    {
      number: 2,
      title: 'Create Project',
      description: 'Create your first project for testing',
      icon: FolderOpen
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">QA</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to QAOne</h1>
          <p className="text-gray-600">Let's set up your workspace in just a few steps</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((stepItem, index) => {
            const Icon = stepItem.icon
            const isActive = step === stepItem.number
            const isCompleted = step > stepItem.number

            return (
              <React.Fragment key={stepItem.number}>
                <div className="flex flex-col items-center">
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center mb-2
                    ${isActive ? 'bg-blue-600 text-white' : 
                      isCompleted ? 'bg-green-600 text-white' : 
                      'bg-gray-200 text-gray-500'}
                  `}>
                    {isCompleted ? (
                      <ArrowRight className="h-6 w-6" />
                    ) : (
                      <Icon className="h-6 w-6" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                      {stepItem.title}
                    </p>
                    <p className="text-xs text-gray-400">{stepItem.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 ${isCompleted ? 'bg-green-600' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">{step}</Badge>
              {steps[step - 1].title}
            </CardTitle>
            <CardDescription>
              {steps[step - 1].description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <form onSubmit={handleOrgSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    placeholder="e.g., Acme Corp"
                    value={orgData.name}
                    onChange={(e) => setOrgData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-description">Description (Optional)</Label>
                  <Textarea
                    id="org-description"
                    placeholder="Brief description of your organization"
                    value={orgData.description}
                    onChange={(e) => setOrgData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Organization...
                    </>
                  ) : (
                    <>
                      Create Organization
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleProjectSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input
                    id="project-name"
                    placeholder="e.g., Web Application"
                    value={projectData.name}
                    onChange={(e) => setProjectData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-description">Description (Optional)</Label>
                  <Textarea
                    id="project-description"
                    placeholder="Brief description of your project"
                    value={projectData.description}
                    onChange={(e) => setProjectData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Project...
                      </>
                    ) : (
                      <>
                        Create Project
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Skip Option */}
        <div className="text-center mt-6">
          <Button variant="ghost" onClick={() => navigate('/')}>
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  )
}
