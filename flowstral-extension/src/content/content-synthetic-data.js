/**
 * Synthetic Data Generator
 * Auto-generates realistic test data for form fields
 * Detects field types and generates appropriate values with constraints
 * Extracted from content.js for modularity
 *
 * Exposes: window._FlowstralSyntheticDataGenerator
 */

(function() {
  'use strict';

  class SyntheticDataGenerator {
    constructor() {
      // Seed data pools
      this.firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'James', 'Emma', 'Robert', 'Olivia', 'William', 'Sophia', 'Richard', 'Isabella', 'Thomas'];
      this.lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson'];
      this.domains = ['example.com', 'test.org', 'demo.net', 'sample.io', 'testmail.com'];
      this.streets = ['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Pine Rd', 'Elm St', 'Park Ave', 'Lake Dr', 'Hill Rd', 'Valley Way'];
      this.cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
      this.states = ['CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI'];
      this.companies = ['Acme Corp', 'TechStart Inc', 'Global Solutions', 'Innovation Labs', 'Digital Dynamics', 'Cloud Systems', 'Data Analytics Co', 'Smart Solutions'];
      this.jobTitles = ['Software Engineer', 'Product Manager', 'Designer', 'Analyst', 'Consultant', 'Director', 'Developer', 'Architect', 'Lead', 'Specialist'];

      // User-defined constraints (loaded from storage)
      this.constraints = {};
      this.loadConstraints();
    }

    /**
     * Load saved constraints from storage
     */
    async loadConstraints() {
      try {
        const stored = localStorage.getItem('qaai_data_constraints');
        if (stored) {
          this.constraints = JSON.parse(stored);
        }
      } catch (e) {
        console.warn('Could not load constraints:', e);
      }
    }

    /**
     * Save constraints to storage
     */
    saveConstraints() {
      try {
        localStorage.setItem('qaai_data_constraints', JSON.stringify(this.constraints));
      } catch (e) {
        console.warn('Could not save constraints:', e);
      }
    }

    /**
     * Set a constraint for a field type or specific field
     * @param {string} key - field type (e.g., 'year') or specific field name
     * @param {object} constraint - { min, max, format, options, pattern }
     */
    setConstraint(key, constraint) {
      this.constraints[key] = constraint;
      this.saveConstraints();
    }

    /**
     * Get constraint for a field
     */
    getConstraint(fieldType, fieldName) {
      // Check specific field name first, then field type
      return this.constraints[fieldName] || this.constraints[fieldType] || null;
    }

    /**
     * Extract constraints from HTML element attributes
     */
    extractElementConstraints(element) {
      const constraints = {};

      // HTML5 validation attributes
      if (element.min) constraints.min = parseFloat(element.min);
      if (element.max) constraints.max = parseFloat(element.max);
      if (element.minLength) constraints.minLength = parseInt(element.minLength);
      if (element.maxLength) constraints.maxLength = parseInt(element.maxLength);
      if (element.pattern) constraints.pattern = element.pattern;
      if (element.step) constraints.step = parseFloat(element.step);

      // For select/dropdown - get all options
      if (element.tagName === 'SELECT') {
        constraints.options = [...element.options]
          .filter(opt => opt.value && opt.value !== '')
          .map(opt => ({
            value: opt.value,
            text: opt.textContent?.trim()
          }));
        constraints.isDropdown = true;
      }

      // For datalist (autocomplete suggestions)
      const datalistId = element.getAttribute('list');
      if (datalistId) {
        const datalist = document.getElementById(datalistId);
        if (datalist) {
          constraints.options = [...datalist.options].map(opt => ({
            value: opt.value,
            text: opt.textContent?.trim() || opt.value
          }));
        }
      }

      // Check for date input constraints
      if (element.type === 'date' || element.type === 'datetime-local') {
        if (element.min) constraints.minDate = element.min;
        if (element.max) constraints.maxDate = element.max;
      }

      return Object.keys(constraints).length > 0 ? constraints : null;
    }

    /**
     * Scan a dropdown/select and get all options
     */
    getDropdownOptions(element) {
      if (element.tagName === 'SELECT') {
        return [...element.options]
          .filter(opt => opt.value && opt.value !== '' && !opt.disabled)
          .map(opt => ({
            value: opt.value,
            text: opt.textContent?.trim()
          }));
      }

      // Handle custom dropdowns (Salesforce, React Select, etc.)
      // Look for associated listbox or menu
      const id = element.id || element.getAttribute('aria-controls');
      if (id) {
        const listbox = document.querySelector(`[aria-labelledby="${id}"], [id="${id}"] [role="listbox"], [id="${id}"] [role="menu"]`);
        if (listbox) {
          const options = listbox.querySelectorAll('[role="option"], [role="menuitem"], li');
          return [...options].map(opt => ({
            value: opt.dataset.value || opt.textContent?.trim(),
            text: opt.textContent?.trim()
          }));
        }
      }

      return [];
    }

    /**
     * Detect field type from element attributes and context
     */
    detectFieldType(element) {
      const type = (element.type || '').toLowerCase();
      const name = (element.name || '').toLowerCase();
      const id = (element.id || '').toLowerCase();
      const placeholder = (element.placeholder || '').toLowerCase();
      const label = this.getAssociatedLabel(element).toLowerCase();
      const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();

      const allText = `${name} ${id} ${placeholder} ${label} ${ariaLabel}`;

      // Check input type first
      if (type === 'email') return 'email';
      if (type === 'tel') return 'phone';
      if (type === 'number') return 'number';
      if (type === 'date') return 'date';
      if (type === 'datetime-local') return 'datetime';
      if (type === 'time') return 'time';
      if (type === 'url') return 'url';
      if (type === 'password') return 'password';

      // Pattern matching on field context
      if (/email|e-mail|correo/.test(allText)) return 'email';
      if (/phone|tel|mobile|cell|fax|telefono/.test(allText)) return 'phone';
      if (/first\s*name|fname|given\s*name|nombre/.test(allText)) return 'firstName';
      if (/last\s*name|lname|surname|family\s*name|apellido/.test(allText)) return 'lastName';
      if (/full\s*name|name|nombre\s*completo/.test(allText) && !/user|company|org/.test(allText)) return 'fullName';
      if (/username|user\s*name|login|usuario/.test(allText)) return 'username';
      if (/password|pwd|pass|contrase/.test(allText)) return 'password';
      if (/company|organization|org\s*name|empresa/.test(allText)) return 'company';
      if (/job\s*title|position|role|title|cargo/.test(allText)) return 'jobTitle';
      if (/street|address\s*1|address\s*line|direccion/.test(allText)) return 'street';
      if (/city|ciudad/.test(allText)) return 'city';
      if (/state|province|estado/.test(allText)) return 'state';
      if (/zip|postal|code|codigo\s*postal/.test(allText)) return 'zipCode';
      if (/country|pais/.test(allText)) return 'country';
      if (/ssn|social\s*security/.test(allText)) return 'ssn';
      if (/credit\s*card|card\s*number|tarjeta/.test(allText)) return 'creditCard';
      if (/cvv|cvc|security\s*code/.test(allText)) return 'cvv';
      if (/expir|exp\s*date|vencimiento/.test(allText)) return 'expiryDate';

      // Date components - check BEFORE generic date
      if (/\bmonth\b|mes\b|mm\b/.test(allText)) return 'month';
      if (/\bday\b|dia\b|dd\b/.test(allText)) return 'day';
      if (/\byear\b|a\u00f1o\b|yyyy\b|yy\b|birth.*year|year.*birth/.test(allText)) return 'year';
      if (/\bdob\b|birth\s*date|date.*birth|fecha.*nacimiento/.test(allText)) return 'birthDate';

      if (/date|fecha/.test(allText)) return 'date';
      if (/age|edad/.test(allText)) return 'age';
      if (/amount|price|cost|total|monto|precio/.test(allText)) return 'currency';
      if (/quantity|qty|cantidad/.test(allText)) return 'quantity';
      if (/description|desc|comment|note|mensaje/.test(allText)) return 'text';
      if (/url|website|sitio/.test(allText)) return 'url';

      // Gender/Sex
      if (/gender|sex|genero/.test(allText)) return 'gender';

      // Default based on element type
      if (element.tagName === 'TEXTAREA') return 'text';
      if (type === 'text' || !type) return 'text';

      return 'text';
    }

    /**
     * Get associated label text for an element
     */
    getAssociatedLabel(element) {
      // Check for label with for attribute
      if (element.id) {
        const label = document.querySelector(`label[for="${element.id}"]`);
        if (label) return label.textContent || '';
      }
      // Check for parent label
      const parentLabel = element.closest('label');
      if (parentLabel) return parentLabel.textContent || '';
      // Check for aria-labelledby
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl) return labelEl.textContent || '';
      }
      return '';
    }

    /**
     * Generate random value from array
     */
    random(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * Generate random number in range
     */
    randomNum(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Generate synthetic data based on field type and constraints
     * @param {string} fieldType
     * @param {object} constraints - { min, max, minAge, maxAge, options, format, pattern }
     */
    generate(fieldType, constraints = {}) {
      const timestamp = Date.now();
      const uniqueId = Math.random().toString(36).substring(2, 8);
      const currentYear = new Date().getFullYear();

      // If we have dropdown options, pick from them
      if (constraints.options?.length > 0) {
        const selected = this.random(constraints.options);
        return selected.value || selected.text;
      }

      switch (fieldType) {
        case 'email':
          const domain = constraints.domain || this.random(this.domains);
          return `test.user${uniqueId}@${domain}`;

        case 'phone':
          return `+1${this.randomNum(200, 999)}${this.randomNum(200, 999)}${this.randomNum(1000, 9999)}`;

        case 'firstName':
          return this.random(this.firstNames);

        case 'lastName':
          return this.random(this.lastNames);

        case 'fullName':
          return `${this.random(this.firstNames)} ${this.random(this.lastNames)}`;

        case 'username':
          return `user_${uniqueId}`;

        case 'password':
          const minLen = constraints.minLength || 8;
          return `Test@${uniqueId}123!`.substring(0, Math.max(minLen, 12));

        case 'company':
          return this.random(this.companies);

        case 'jobTitle':
          return this.random(this.jobTitles);

        case 'street':
          return `${this.randomNum(100, 9999)} ${this.random(this.streets)}`;

        case 'city':
          return this.random(this.cities);

        case 'state':
          return this.random(this.states);

        case 'zipCode':
          return `${this.randomNum(10000, 99999)}`;

        case 'country':
          return 'United States';

        case 'ssn':
          return `${this.randomNum(100, 999)}-${this.randomNum(10, 99)}-${this.randomNum(1000, 9999)}`;

        case 'creditCard':
          return `4111-1111-1111-${this.randomNum(1000, 9999)}`;

        case 'cvv':
          return `${this.randomNum(100, 999)}`;

        case 'expiryDate':
          const futureYear = new Date().getFullYear() + this.randomNum(1, 5);
          return `${this.randomNum(1, 12).toString().padStart(2, '0')}/${futureYear.toString().slice(-2)}`;

        case 'month':
          const minMonth = constraints.min || 1;
          const maxMonth = constraints.max || 12;
          if (constraints.format === 'name') {
            const months = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
            return months[this.randomNum(minMonth - 1, maxMonth - 1)];
          }
          return `${this.randomNum(minMonth, maxMonth)}`;

        case 'day':
          const minDay = constraints.min || 1;
          const maxDay = constraints.max || 28;
          return `${this.randomNum(minDay, maxDay)}`;

        case 'year':
          const minAge = constraints.minAge || constraints.min || 18;
          const maxAge = constraints.maxAge || constraints.max || 65;
          const yearMin = currentYear - maxAge;
          const yearMax = currentYear - minAge;
          return `${this.randomNum(yearMin, yearMax)}`;

        case 'birthDate':
          const bdMinAge = constraints.minAge || 18;
          const bdMaxAge = constraints.maxAge || 65;
          const bdYear = currentYear - this.randomNum(bdMinAge, bdMaxAge);
          const bdMonth = this.randomNum(1, 12);
          const bdDay = this.randomNum(1, 28);
          return `${bdYear}-${bdMonth.toString().padStart(2, '0')}-${bdDay.toString().padStart(2, '0')}`;

        case 'gender':
          const genderOptions = constraints.options || ['Male', 'Female', 'Other', 'Prefer not to say'];
          return this.random(genderOptions);

        case 'date':
          const date = new Date();
          date.setDate(date.getDate() + this.randomNum(-365, 365));
          return date.toISOString().split('T')[0];

        case 'datetime':
          const dt = new Date();
          dt.setDate(dt.getDate() + this.randomNum(-30, 30));
          return dt.toISOString().slice(0, 16);

        case 'time':
          return `${this.randomNum(0, 23).toString().padStart(2, '0')}:${this.randomNum(0, 59).toString().padStart(2, '0')}`;

        case 'age':
          return `${this.randomNum(18, 80)}`;

        case 'currency':
          return `${this.randomNum(10, 10000)}.${this.randomNum(0, 99).toString().padStart(2, '0')}`;

        case 'quantity':
          return `${this.randomNum(1, 100)}`;

        case 'number':
          return `${this.randomNum(1, 1000)}`;

        case 'url':
          return `https://www.${this.random(this.domains)}/page/${uniqueId}`;

        case 'text':
        default:
          const texts = [
            'This is a test entry',
            'Sample data for testing',
            'Automated test input',
            'Lorem ipsum dolor sit amet',
            'Test description here'
          ];
          return this.random(texts);
      }
    }

    /**
     * Analyze an element and return suggested test data with constraints
     */
    analyzeElement(element) {
      const fieldType = this.detectFieldType(element);
      const fieldName = element.name || element.id || '';

      // Get constraints from multiple sources
      const htmlConstraints = this.extractElementConstraints(element);
      const userConstraints = this.getConstraint(fieldType, fieldName);
      const mergedConstraints = { ...htmlConstraints, ...userConstraints };

      // For dropdowns, always pick from actual options
      let value, options = [];
      if (mergedConstraints.isDropdown || mergedConstraints.options?.length > 0) {
        options = mergedConstraints.options || this.getDropdownOptions(element);
        if (options.length > 0) {
          const selected = this.random(options);
          value = selected.value || selected.text;
        } else {
          value = this.generate(fieldType, mergedConstraints);
        }
      } else {
        value = this.generate(fieldType, mergedConstraints);
      }

      return {
        fieldType,
        fieldName,
        suggestedValue: value,
        confidence: this.getConfidence(element, fieldType),
        alternatives: this.getAlternatives(fieldType, mergedConstraints, options),
        constraints: mergedConstraints,
        hasOptions: options.length > 0,
        options: options.slice(0, 10)  // Include first 10 options for UI
      };
    }

    /**
     * Get confidence score for field type detection
     */
    getConfidence(element, fieldType) {
      const type = (element.type || '').toLowerCase();

      // High confidence if HTML type matches
      if (type === 'email' && fieldType === 'email') return 1.0;
      if (type === 'tel' && fieldType === 'phone') return 1.0;
      if (type === 'date' && fieldType === 'date') return 1.0;
      if (type === 'number' && fieldType === 'number') return 1.0;

      // Medium confidence for pattern matches
      if (fieldType !== 'text') return 0.8;

      // Low confidence for default text
      return 0.5;
    }

    /**
     * Get alternative values for a field type with constraints
     */
    getAlternatives(fieldType, constraints = {}, options = []) {
      // If we have dropdown options, return a sample of them
      if (options.length > 0) {
        const shuffled = [...options].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(5, options.length)).map(o => o.value || o.text);
      }

      // Generate 3 alternative values with constraints
      return [
        this.generate(fieldType, constraints),
        this.generate(fieldType, constraints),
        this.generate(fieldType, constraints)
      ];
    }

    /**
     * Generate test data for all input fields on page
     */
    generatePageTestData(inputs) {
      const testData = [];

      for (const input of inputs) {
        const analysis = this.analyzeElement(input.element || input);
        testData.push({
          fieldName: input.label || input.name || input.id || `field_${testData.length}`,
          fieldType: analysis.fieldType,
          selector: input.selectorObj?.playwright || input.selector,
          value: analysis.suggestedValue,
          alternatives: analysis.alternatives,
          confidence: analysis.confidence
        });
      }

      return testData;
    }
  }

  window._FlowstralSyntheticDataGenerator = SyntheticDataGenerator;
})();
