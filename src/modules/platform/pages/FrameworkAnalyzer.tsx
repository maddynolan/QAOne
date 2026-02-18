/**
 * Framework Analyzer Page
 * 
 * Analyze existing automation frameworks to extract:
 * - Domain models
 * - Requirements
 * - Test cases
 * - Convert to modern frameworks
 */

import { useState, useCallback } from 'react';
import {
  Code, Upload, FolderOpen, GitBranch, FileText, Download,
  Play, Loader2, CheckCircle, AlertCircle, Copy, Eye,
  FileCode, BookOpen, TestTube, Layers, RefreshCw,
  ChevronRight, Zap, Settings, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { API_BASE_URL as API_BASE } from '@/lib/api-config';

interface AnalysisResult {
  status: string; // "success" or "error"
  analysis?: {
    success?: boolean;
    framework?: {
      framework_name: string;
      framework_type: string;
      language: string;
      patterns_used: string[];
    };
    domain?: {
      domain: string;
      entities: string[];
      pages_count: number;
      tests_count: number;
      flows_count: number;
      rules_count: number;
    };
    error?: string;
  };
  result?: {
    success: boolean;
  };
  error?: string;
}

// Helper to check if analysis was successful
const isAnalysisSuccessful = (result: AnalysisResult | null): boolean => {
  if (!result) return false;
  return result.status === 'success' || result.analysis?.success === true || result.result?.success === true;
};

interface GeneratedOutput {
  status: string;
  content?: string;
  format?: string;
}

export default function FrameworkAnalyzer() {
  // Input state
  const [inputMode, setInputMode] = useState<'code' | 'directory' | 'upload' | 'vcs'>('code');
  const [codeInput, setCodeInput] = useState('');
  const [fileName, setFileName] = useState('Test.java');
  const [directoryPath, setDirectoryPath] = useState('');
  const [vcsUrl, setVcsUrl] = useState('');
  const [vcsBranch, setVcsBranch] = useState('');
  const [vcsToken, setVcsToken] = useState('');
  const [vcsBranches, setVcsBranches] = useState<string[]>([]);
  const [vcsProvider, setVcsProvider] = useState<string | null>(null);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [useLlm, setUseLlm] = useState(true);
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  
  // Output state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedOutputs, setGeneratedOutputs] = useState<Record<string, string>>({});
  const [selectedOutputTab, setSelectedOutputTab] = useState('requirements');
  
  // Conversion state
  const [targetFramework, setTargetFramework] = useState('playwright-python');
  const [isConverting, setIsConverting] = useState(false);
  const [convertedFiles, setConvertedFiles] = useState<Record<string, string>>({});

  // Sample code for demonstration
  // Sample code snippets for different frameworks
  const frameworkSamples: Record<string, { code: string; fileName: string; expectedFramework: string }> = {
    'selenium-java-testng': {
      code: `package com.example.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.PageFactory;
import org.testng.Assert;
import org.testng.annotations.Test;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.AfterMethod;

public class LoginPageTest extends BaseTest {
    
    @BeforeMethod
    public void setUp() {
        driver.get("https://example.com/login");
    }
    
    @Test(priority = 1)
    public void testValidLogin() {
        LoginPage loginPage = new LoginPage(driver);
        loginPage.enterUsername("testuser@example.com");
        loginPage.enterPassword("SecurePass123");
        loginPage.clickLoginButton();
        
        DashboardPage dashboardPage = new DashboardPage(driver);
        Assert.assertTrue(dashboardPage.isWelcomeMessageDisplayed());
    }
    
    @Test(priority = 2)
    public void testInvalidLogin() {
        LoginPage loginPage = new LoginPage(driver);
        loginPage.enterUsername("invalid@example.com");
        loginPage.enterPassword("wrongpassword");
        loginPage.clickLoginButton();
        
        Assert.assertTrue(loginPage.isErrorMessageDisplayed());
    }
}`,
      fileName: 'LoginPageTest.java',
      expectedFramework: 'Selenium Java + TestNG'
    },
    'selenium-java-junit': {
      code: `package com.example.tests;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.By;

public class LoginTest {
    private WebDriver driver;
    
    @BeforeEach
    public void setUp() {
        driver = new ChromeDriver();
        driver.get("https://example.com/login");
    }
    
    @AfterEach
    public void tearDown() {
        driver.quit();
    }
    
    @Test
    public void testValidLogin() {
        driver.findElement(By.id("username")).sendKeys("user@example.com");
        driver.findElement(By.id("password")).sendKeys("password123");
        driver.findElement(By.id("loginBtn")).click();
        
        Assertions.assertTrue(driver.findElement(By.id("welcome")).isDisplayed());
    }
}`,
      fileName: 'LoginTest.java',
      expectedFramework: 'Selenium Java + JUnit'
    },
    'playwright-python': {
      code: `import pytest
from playwright.sync_api import Page, expect

class TestLogin:
    def test_valid_login(self, page: Page):
        page.goto("https://example.com/login")
        
        page.get_by_label("Username").fill("testuser@example.com")
        page.get_by_label("Password").fill("SecurePass123")
        page.get_by_role("button", name="Login").click()
        
        expect(page.get_by_text("Welcome")).to_be_visible()
        expect(page.locator(".dashboard")).to_be_visible()
    
    def test_invalid_login(self, page: Page):
        page.goto("https://example.com/login")
        
        page.get_by_label("Username").fill("invalid@example.com")
        page.get_by_label("Password").fill("wrongpassword")
        page.get_by_role("button", name="Login").click()
        
        expect(page.get_by_text("Invalid credentials")).to_be_visible()
    
    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        page.set_viewport_size({"width": 1920, "height": 1080})`,
      fileName: 'test_login.py',
      expectedFramework: 'Playwright Python + PyTest'
    },
    'playwright-typescript': {
      code: `import { test, expect } from '@playwright/test';

test.describe('Login Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://example.com/login');
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.getByLabel('Username').fill('testuser@example.com');
    await page.getByLabel('Password').fill('SecurePass123');
    await page.getByRole('button', { name: 'Login' }).click();
    
    await expect(page.getByText('Welcome')).toBeVisible();
    await expect(page.locator('.dashboard')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByLabel('Username').fill('invalid@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Login' }).click();
    
    await expect(page.getByText('Invalid credentials')).toBeVisible();
  });

  test('should navigate to forgot password', async ({ page }) => {
    await page.getByText('Forgot Password?').click();
    await expect(page).toHaveURL(/.*forgot-password/);
  });
});`,
      fileName: 'login.spec.ts',
      expectedFramework: 'Playwright TypeScript'
    },
    'cypress': {
      code: `describe('Login Page Tests', () => {
  beforeEach(() => {
    cy.visit('https://example.com/login');
  });

  it('should login with valid credentials', () => {
    cy.get('#username').type('testuser@example.com');
    cy.get('#password').type('SecurePass123');
    cy.get('#loginBtn').click();
    
    cy.get('.welcome-message').should('be.visible');
    cy.url().should('include', '/dashboard');
  });

  it('should show error for invalid credentials', () => {
    cy.get('#username').type('invalid@example.com');
    cy.get('#password').type('wrongpassword');
    cy.get('#loginBtn').click();
    
    cy.get('.error-message').should('be.visible');
    cy.contains('Invalid credentials').should('exist');
  });

  it('should navigate to forgot password page', () => {
    cy.contains('Forgot Password?').click();
    cy.url().should('include', '/forgot-password');
    cy.get('h1').should('contain', 'Reset Password');
  });
});`,
      fileName: 'login.cy.js',
      expectedFramework: 'Cypress'
    },
    'selenium-python': {
      code: `import unittest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class TestLogin(unittest.TestCase):
    def setUp(self):
        self.driver = webdriver.Chrome()
        self.driver.get("https://example.com/login")
        self.wait = WebDriverWait(self.driver, 10)
    
    def tearDown(self):
        self.driver.quit()
    
    def test_valid_login(self):
        self.driver.find_element(By.ID, "username").send_keys("user@example.com")
        self.driver.find_element(By.ID, "password").send_keys("password123")
        self.driver.find_element(By.ID, "loginBtn").click()
        
        welcome = self.wait.until(EC.visibility_of_element_located((By.ID, "welcome")))
        self.assertTrue(welcome.is_displayed())
    
    def test_invalid_login(self):
        self.driver.find_element(By.ID, "username").send_keys("invalid@example.com")
        self.driver.find_element(By.ID, "password").send_keys("wrongpassword")
        self.driver.find_element(By.ID, "loginBtn").click()
        
        error = self.wait.until(EC.visibility_of_element_located((By.CLASS_NAME, "error")))
        self.assertIn("Invalid credentials", error.text)

if __name__ == "__main__":
    unittest.main()`,
      fileName: 'test_login.py',
      expectedFramework: 'Selenium Python'
    },
    'pytest': {
      code: `import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By

class TestLogin:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.driver = webdriver.Chrome()
        self.driver.get("https://example.com/login")
        yield
        self.driver.quit()
    
    @pytest.mark.smoke
    def test_valid_login(self):
        self.driver.find_element(By.ID, "username").send_keys("user@example.com")
        self.driver.find_element(By.ID, "password").send_keys("password123")
        self.driver.find_element(By.ID, "loginBtn").click()
        
        assert self.driver.find_element(By.ID, "welcome").is_displayed()
    
    @pytest.mark.parametrize("username,password", [
        ("invalid@example.com", "wrongpassword"),
        ("user@example.com", "wrongpassword"),
        ("", "password123"),
    ])
    def test_invalid_login(self, username, password):
        self.driver.find_element(By.ID, "username").send_keys(username)
        self.driver.find_element(By.ID, "password").send_keys(password)
        self.driver.find_element(By.ID, "loginBtn").click()
        
        assert self.driver.find_element(By.CLASS_NAME, "error").is_displayed()`,
      fileName: 'test_login.py',
      expectedFramework: 'PyTest + Selenium'
    },
    'robot-framework': {
      code: `*** Settings ***
Library    SeleniumLibrary
Library    Collections

*** Variables ***
\${URL}         https://example.com/login
\${BROWSER}     chrome
\${USERNAME}    testuser@example.com
\${PASSWORD}    SecurePass123

*** Test Cases ***
Valid Login Test
    [Documentation]    Verify user can login with valid credentials
    [Tags]    smoke    login
    Open Browser    \${URL}    \${BROWSER}
    Input Text    id:username    \${USERNAME}
    Input Password    id:password    \${PASSWORD}
    Click Button    id:loginBtn
    Page Should Contain Element    class:welcome-message
    [Teardown]    Close Browser

Invalid Login Test
    [Documentation]    Verify error message for invalid credentials
    [Tags]    regression    login
    Open Browser    \${URL}    \${BROWSER}
    Input Text    id:username    invalid@example.com
    Input Password    id:password    wrongpassword
    Click Button    id:loginBtn
    Page Should Contain    Invalid credentials
    [Teardown]    Close Browser

*** Keywords ***
Login With Credentials
    [Arguments]    \${username}    \${password}
    Input Text    id:username    \${username}
    Input Password    id:password    \${password}
    Click Button    id:loginBtn`,
      fileName: 'login_tests.robot',
      expectedFramework: 'Robot Framework'
    },
    'cucumber-java': {
      code: `Feature: User Login
  As a user
  I want to login to the application
  So that I can access my account

  Background:
    Given I am on the login page

  @smoke @login
  Scenario: Successful login with valid credentials
    When I enter username "testuser@example.com"
    And I enter password "SecurePass123"
    And I click the login button
    Then I should see the dashboard
    And I should see the welcome message

  @regression @login
  Scenario: Failed login with invalid credentials
    When I enter username "invalid@example.com"
    And I enter password "wrongpassword"
    And I click the login button
    Then I should see an error message "Invalid credentials"

  @regression @login
  Scenario Outline: Failed login with various invalid inputs
    When I enter username "<username>"
    And I enter password "<password>"
    And I click the login button
    Then I should see an error message "<error>"

    Examples:
      | username              | password      | error                    |
      | invalid@example.com   | wrongpassword | Invalid credentials      |
      | testuser@example.com  | wrong         | Invalid credentials      |
      |                       | password123   | Username is required     |`,
      fileName: 'login.feature',
      expectedFramework: 'Cucumber/BDD'
    },
    'selenium-csharp': {
      code: `using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace TestProject.Tests
{
    [TestFixture]
    public class LoginTests
    {
        private IWebDriver driver;
        private WebDriverWait wait;
        
        [SetUp]
        public void Setup()
        {
            driver = new ChromeDriver();
            wait = new WebDriverWait(driver, TimeSpan.FromSeconds(10));
            driver.Navigate().GoToUrl("https://example.com/login");
        }
        
        [TearDown]
        public void TearDown()
        {
            driver.Quit();
        }
        
        [Test]
        public void ValidLogin_ShouldShowDashboard()
        {
            driver.FindElement(By.Id("username")).SendKeys("user@example.com");
            driver.FindElement(By.Id("password")).SendKeys("password123");
            driver.FindElement(By.Id("loginBtn")).Click();
            
            var welcome = wait.Until(d => d.FindElement(By.Id("welcome")));
            Assert.IsTrue(welcome.Displayed);
        }
        
        [Test]
        public void InvalidLogin_ShouldShowError()
        {
            driver.FindElement(By.Id("username")).SendKeys("invalid@example.com");
            driver.FindElement(By.Id("password")).SendKeys("wrongpassword");
            driver.FindElement(By.Id("loginBtn")).Click();
            
            var error = wait.Until(d => d.FindElement(By.ClassName("error")));
            Assert.That(error.Text, Does.Contain("Invalid credentials"));
        }
    }
}`,
      fileName: 'LoginTests.cs',
      expectedFramework: 'Selenium C# + NUnit'
    }
  };
  
  const [selectedSample, setSelectedSample] = useState<string>('selenium-java-testng');

  const analyzeCode = useCallback(async () => {
    if (!codeInput.trim()) {
      toast.error('Please enter some code to analyze');
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisProgress(10);
    
    try {
      setAnalysisProgress(30);
      
      const response = await fetch(`${API_BASE}/api/framework-analyzer/analyze/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeInput,
          file_name: fileName,
          use_llm: useLlm,
        }),
      });
      
      setAnalysisProgress(70);
      
      if (!response.ok) {
        throw new Error('Analysis failed');
      }
      
      const data = await response.json();
      setAnalysisResult(data);
      setAnalysisProgress(100);
      
      if (data.status === 'success') {
        toast.success('Analysis complete!');
      } else {
        toast.error(data.analysis?.error || 'Analysis failed');
      }
      
    } catch (error: any) {
      toast.error(`Analysis failed: ${error.message}`);
      setAnalysisResult({ status: 'error', error: error.message });
    } finally {
      setIsAnalyzing(false);
    }
  }, [codeInput, fileName, useLlm]);

  const analyzeDirectory = useCallback(async () => {
    if (!directoryPath.trim()) {
      toast.error('Please enter a directory path');
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisProgress(10);
    
    try {
      setAnalysisProgress(30);
      
      const response = await fetch(`${API_BASE}/api/framework-analyzer/analyze/directory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directory_path: directoryPath,
          use_llm: useLlm,
        }),
      });
      
      setAnalysisProgress(70);
      
      if (!response.ok) {
        throw new Error('Analysis failed');
      }
      
      const data = await response.json();
      setAnalysisResult(data);
      setAnalysisProgress(100);
      
      if (data.status === 'success') {
        toast.success(`Analysis complete! Found ${data.analysis?.domain?.tests_count || 0} tests`);
      } else {
        toast.error(data.analysis?.error || 'Analysis failed');
      }
      
    } catch (error: any) {
      toast.error(`Analysis failed: ${error.message}`);
      setAnalysisResult({ status: 'error', error: error.message });
    } finally {
      setIsAnalyzing(false);
    }
  }, [directoryPath, useLlm]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.zip')) {
      toast.error('Please upload a .zip file');
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisProgress(10);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('use_llm', String(useLlm));
      
      setAnalysisProgress(30);
      
      const response = await fetch(`${API_BASE}/api/framework-analyzer/analyze/upload`, {
        method: 'POST',
        body: formData,
      });
      
      setAnalysisProgress(70);
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      setAnalysisResult(data);
      setAnalysisProgress(100);
      
      if (data.status === 'success') {
        toast.success(`Analysis complete! Analyzed ${data.filename}`);
      } else {
        toast.error(data.analysis?.error || 'Analysis failed');
      }
      
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
      setAnalysisResult({ status: 'error', error: error.message });
    } finally {
      setIsAnalyzing(false);
    }
  }, [useLlm]);

  const generateOutput = useCallback(async (outputType: string) => {
    if (!isAnalysisSuccessful(analysisResult)) {
      toast.error('Please run analysis first');
      return;
    }
    
    setIsGenerating(true);
    
    try {
      const endpoint = {
        requirements: '/api/framework-analyzer/generate/requirements',
        test_cases: '/api/framework-analyzer/generate/test-cases',
        domain_docs: '/api/framework-analyzer/generate/domain-docs',
        elements: '/api/framework-analyzer/generate/elements',
        coverage: '/api/framework-analyzer/generate/coverage',
      }[outputType];
      
      if (!endpoint) {
        throw new Error('Invalid output type');
      }
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error('Generation failed');
      }
      
      const data: GeneratedOutput = await response.json();
      
      if (data.status === 'success' && data.content) {
        setGeneratedOutputs(prev => ({ ...prev, [outputType]: data.content! }));
        toast.success(`${outputType} generated!`);
      } else {
        toast.error('Generation failed');
      }
      
    } catch (error: any) {
      toast.error(`Generation failed: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [analysisResult]);

  const convertFramework = useCallback(async () => {
    if (!isAnalysisSuccessful(analysisResult)) {
      toast.error('Please run analysis first');
      return;
    }
    
    setIsConverting(true);
    
    try {
      const response = await fetch(`${API_BASE}/api/framework-analyzer/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_framework: targetFramework,
          include_page_objects: true,
          include_fixtures: true,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Conversion failed');
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setConvertedFiles(data.files);
        toast.success(`Converted to ${targetFramework}! ${data.file_count} files generated.`);
      } else {
        toast.error('Conversion failed');
      }
      
    } catch (error: any) {
      toast.error(`Conversion failed: ${error.message}`);
    } finally {
      setIsConverting(false);
    }
  }, [analysisResult, targetFramework]);

  const downloadConverted = useCallback(async () => {
    if (!isAnalysisSuccessful(analysisResult)) {
      toast.error('Please run analysis first');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/framework-analyzer/convert/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_framework: targetFramework,
          include_page_objects: true,
          include_fixtures: true,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `converted_${targetFramework}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Download started!');
      
    } catch (error: any) {
      toast.error(`Download failed: ${error.message}`);
    }
  }, [analysisResult, targetFramework]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  }, []);

  // Validate VCS URL and detect provider
  const validateVcsUrl = useCallback(async (url: string) => {
    if (!url.trim()) {
      setVcsProvider(null);
      setVcsBranches([]);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/framework-analyzer/vcs/validate?repo_url=${encodeURIComponent(url)}`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.valid) {
        setVcsProvider(data.provider);
        if (!vcsBranch) {
          setVcsBranch(data.detected_branch || 'main');
        }
        // Load branches
        loadBranches(url);
      } else {
        setVcsProvider(null);
      }
    } catch (error) {
      setVcsProvider(null);
    }
  }, [vcsBranch]);

  // Load branches for a repository
  const loadBranches = useCallback(async (url: string) => {
    setIsLoadingBranches(true);
    try {
      const response = await fetch(`${API_BASE}/api/framework-analyzer/vcs/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: url,
          token: vcsToken || undefined,
        }),
      });
      const data = await response.json();
      
      if (data.status === 'success') {
        setVcsBranches(data.branches || []);
      }
    } catch (error) {
      console.error('Failed to load branches:', error);
    } finally {
      setIsLoadingBranches(false);
    }
  }, [vcsToken]);

  // Analyze VCS repository
  const analyzeVcs = useCallback(async () => {
    if (!vcsUrl.trim()) {
      toast.error('Please enter a repository URL');
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisProgress(10);
    
    try {
      setAnalysisProgress(20);
      
      const response = await fetch(`${API_BASE}/api/framework-analyzer/analyze/vcs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: vcsUrl,
          branch: vcsBranch || undefined,
          use_llm: useLlm,
          token: vcsToken || undefined,
        }),
      });
      
      setAnalysisProgress(70);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Analysis failed');
      }
      
      const data = await response.json();
      setAnalysisResult(data);
      setAnalysisProgress(100);
      
      if (data.status === 'success') {
        toast.success(`Analysis complete! Provider: ${data.provider}, Branch: ${data.branch}`);
      } else {
        toast.error(data.analysis?.error || 'Analysis failed');
      }
      
    } catch (error: any) {
      toast.error(`Analysis failed: ${error.message}`);
      setAnalysisResult({ status: 'error', error: error.message });
    } finally {
      setIsAnalyzing(false);
    }
  }, [vcsUrl, vcsBranch, vcsToken, useLlm]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Code className="h-8 w-8 text-purple-500" />
            Framework Analyzer
          </h1>
          <p className="text-muted-foreground mt-2">
            Analyze automation frameworks to extract domain models, requirements, and convert to modern frameworks
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          <Zap className="h-3 w-3 mr-1" />
          AI-Powered
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Input Source
            </CardTitle>
            <CardDescription>
              Provide your automation framework code for analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Input Mode Tabs */}
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as any)}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="code">
                  <FileCode className="h-4 w-4 mr-1" />
                  Code
                </TabsTrigger>
                <TabsTrigger value="directory">
                  <FolderOpen className="h-4 w-4 mr-1" />
                  Directory
                </TabsTrigger>
                <TabsTrigger value="upload">
                  <Upload className="h-4 w-4 mr-1" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="vcs">
                  <GitBranch className="h-4 w-4 mr-1" />
                  VCS
                </TabsTrigger>
              </TabsList>

              <TabsContent value="code" className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Code Snippet</Label>
                    <Select
                      value={selectedSample}
                      onValueChange={(value) => {
                        setSelectedSample(value);
                        const sample = frameworkSamples[value];
                        if (sample) {
                          setCodeInput(sample.code);
                          setFileName(sample.fileName);
                        }
                      }}
                    >
                      <SelectTrigger className="w-[200px] h-8">
                        <SelectValue placeholder="Load Sample..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="selenium-java-testng">Selenium Java + TestNG</SelectItem>
                        <SelectItem value="selenium-java-junit">Selenium Java + JUnit</SelectItem>
                        <SelectItem value="playwright-python">Playwright Python</SelectItem>
                        <SelectItem value="playwright-typescript">Playwright TypeScript</SelectItem>
                        <SelectItem value="cypress">Cypress</SelectItem>
                        <SelectItem value="selenium-python">Selenium Python</SelectItem>
                        <SelectItem value="pytest">PyTest + Selenium</SelectItem>
                        <SelectItem value="robot-framework">Robot Framework</SelectItem>
                        <SelectItem value="cucumber-java">Cucumber/BDD</SelectItem>
                        <SelectItem value="selenium-csharp">Selenium C#</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    placeholder="Paste your automation test code here..."
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    className="font-mono text-sm min-h-[300px]"
                  />
                </div>
                {frameworkSamples[selectedSample] && (
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    <strong>Expected Detection:</strong> {frameworkSamples[selectedSample].expectedFramework}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>File Name (for language detection)</Label>
                  <Select value={fileName} onValueChange={setFileName}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Test.java">Test.java (Selenium Java)</SelectItem>
                      <SelectItem value="test_example.py">test_example.py (Python)</SelectItem>
                      <SelectItem value="example.spec.ts">example.spec.ts (Playwright TS)</SelectItem>
                      <SelectItem value="example.cy.js">example.cy.js (Cypress)</SelectItem>
                      <SelectItem value="example.robot">example.robot (Robot Framework)</SelectItem>
                      <SelectItem value="example.feature">example.feature (Gherkin)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={analyzeCode} disabled={isAnalyzing} className="w-full">
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Analyze Code
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="directory" className="space-y-4">
                <div className="space-y-2">
                  <Label>Directory Path</Label>
                  <Input
                    placeholder="C:\path\to\your\automation\project"
                    value={directoryPath}
                    onChange={(e) => setDirectoryPath(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the full path to your automation project directory
                  </p>
                </div>
                <Button onClick={analyzeDirectory} disabled={isAnalyzing} className="w-full">
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Analyze Directory
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload a ZIP file containing your automation framework
                  </p>
                  <Input
                    type="file"
                    accept=".zip"
                    onChange={handleFileUpload}
                    className="max-w-[200px] mx-auto"
                  />
                </div>
              </TabsContent>

              <TabsContent value="vcs" className="space-y-4">
                <div className="space-y-2">
                  <Label>Repository URL</Label>
                  <Input
                    placeholder="https://github.com/user/repo or gitlab.com/user/repo"
                    value={vcsUrl}
                    onChange={(e) => {
                      setVcsUrl(e.target.value);
                      validateVcsUrl(e.target.value);
                    }}
                  />
                  {vcsProvider && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Detected provider: </span>
                      <Badge variant="outline">{vcsProvider}</Badge>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    {isLoadingBranches ? (
                      <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Loading branches...</span>
                      </div>
                    ) : vcsBranches.length > 0 ? (
                      <Select value={vcsBranch} onValueChange={setVcsBranch}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {vcsBranches.map(branch => (
                            <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="main"
                        value={vcsBranch}
                        onChange={(e) => setVcsBranch(e.target.value)}
                      />
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Access Token (for private repos)</Label>
                    <Input
                      type="password"
                      placeholder="Optional"
                      value={vcsToken}
                      onChange={(e) => setVcsToken(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Supported Providers:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">GitHub</Badge>
                    <Badge variant="outline">GitLab</Badge>
                    <Badge variant="outline">Bitbucket</Badge>
                    <Badge variant="outline">Azure DevOps</Badge>
                  </div>
                </div>
                
                <Button onClick={analyzeVcs} disabled={isAnalyzing || !vcsUrl} className="w-full">
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Downloading & Analyzing...
                    </>
                  ) : (
                    <>
                      <GitBranch className="h-4 w-4 mr-2" />
                      Analyze Repository
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>

            {/* Options */}
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <Label htmlFor="use-llm">Use AI for Enhanced Analysis</Label>
              </div>
              <Switch
                id="use-llm"
                checked={useLlm}
                onCheckedChange={setUseLlm}
              />
            </div>

            {/* Progress */}
            {isAnalyzing && (
              <div className="space-y-2">
                <Progress value={analysisProgress} />
                <p className="text-xs text-muted-foreground text-center">
                  Analyzing framework structure...
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Analysis Results
            </CardTitle>
            <CardDescription>
              Extracted domain model and framework information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!analysisResult ? (
              <div className="text-center py-12 text-muted-foreground">
                <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Run analysis to see results</p>
              </div>
            ) : isAnalysisSuccessful(analysisResult) ? (
              <div className="space-y-4">
                {/* Framework Info */}
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Framework Detected
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Type:</span>{' '}
                      <Badge variant="outline">{analysisResult.analysis?.framework?.framework_name || 'Unknown'}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Language:</span>{' '}
                      <Badge variant="outline">{analysisResult.analysis?.framework?.language || 'Unknown'}</Badge>
                    </div>
                  </div>
                  {analysisResult.analysis?.framework?.patterns_used && analysisResult.analysis.framework.patterns_used.length > 0 && (
                    <div className="mt-2">
                      <span className="text-sm text-muted-foreground">Patterns:</span>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {analysisResult.analysis.framework.patterns_used.map((p, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Domain Info */}
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-500" />
                    Domain Model
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Domain:</span>{' '}
                      <Badge>{analysisResult.analysis?.domain?.domain || 'General'}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tests:</span>{' '}
                      <span className="font-medium">{analysisResult.analysis?.domain?.tests_count || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pages:</span>{' '}
                      <span className="font-medium">{analysisResult.analysis?.domain?.pages_count || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rules:</span>{' '}
                      <span className="font-medium">{analysisResult.analysis?.domain?.rules_count || 0}</span>
                    </div>
                  </div>
                  {analysisResult.analysis?.domain?.entities && analysisResult.analysis.domain.entities.length > 0 && (
                    <div className="mt-2">
                      <span className="text-sm text-muted-foreground">Entities:</span>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {analysisResult.analysis.domain.entities.slice(0, 8).map((e, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{e}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
                <p className="text-red-500">{analysisResult.error || 'Analysis failed'}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Output Generation */}
      {isAnalysisSuccessful(analysisResult) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generate Outputs
            </CardTitle>
            <CardDescription>
              Generate requirements, test cases, and documentation from the analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedOutputTab} onValueChange={setSelectedOutputTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="requirements">
                  <BookOpen className="h-4 w-4 mr-1" />
                  Requirements
                </TabsTrigger>
                <TabsTrigger value="test_cases">
                  <TestTube className="h-4 w-4 mr-1" />
                  Test Cases
                </TabsTrigger>
                <TabsTrigger value="domain_docs">
                  <FileText className="h-4 w-4 mr-1" />
                  Domain Docs
                </TabsTrigger>
                <TabsTrigger value="coverage">
                  <Layers className="h-4 w-4 mr-1" />
                  Coverage
                </TabsTrigger>
                <TabsTrigger value="convert">
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Convert
                </TabsTrigger>
              </TabsList>

              {['requirements', 'test_cases', 'domain_docs', 'coverage'].map(tab => (
                <TabsContent key={tab} value={tab} className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => generateOutput(tab)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Generate
                    </Button>
                    {generatedOutputs[tab] && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => copyToClipboard(generatedOutputs[tab])}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const blob = new Blob([generatedOutputs[tab]], { type: 'text/markdown' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${tab}.md`;
                            a.click();
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </>
                    )}
                  </div>
                  {generatedOutputs[tab] ? (
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-[400px] whitespace-pre-wrap">
                      {generatedOutputs[tab]}
                    </pre>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Click "Generate" to create {tab.replace('_', ' ')}
                    </div>
                  )}
                </TabsContent>
              ))}

              <TabsContent value="convert" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target Framework</Label>
                    <Select value={targetFramework} onValueChange={setTargetFramework}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="playwright-python">
                          <span className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">Recommended</Badge>
                            Playwright (Python)
                          </span>
                        </SelectItem>
                        <SelectItem value="playwright-typescript">Playwright (TypeScript)</SelectItem>
                        <SelectItem value="cypress">Cypress</SelectItem>
                        <SelectItem value="selenium-python">Selenium (Python)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button onClick={convertFramework} disabled={isConverting}>
                      {isConverting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4 mr-2" />
                      )}
                      Convert
                    </Button>
                    {Object.keys(convertedFiles).length > 0 && (
                      <Button variant="outline" onClick={downloadConverted}>
                        <Download className="h-4 w-4 mr-2" />
                        Download ZIP
                      </Button>
                    )}
                  </div>
                </div>

                {Object.keys(convertedFiles).length > 0 && (
                  <div className="space-y-2">
                    <Label>Generated Files ({Object.keys(convertedFiles).length})</Label>
                    <div className="border rounded-lg divide-y max-h-[400px] overflow-auto">
                      {Object.entries(convertedFiles).map(([filename, content]) => (
                        <div key={filename} className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-sm flex items-center gap-2">
                              <FileCode className="h-4 w-4" />
                              {filename}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(content)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-[150px]">
                            {content.substring(0, 500)}{content.length > 500 ? '...' : ''}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

