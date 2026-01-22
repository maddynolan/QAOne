/**
 * Confidence Calculator
 * 
 * Calculates confidence scores for element finding operations.
 * Score range: 0-100
 * 
 * @author Flowstral QA Team
 * @version 1.0.0
 */

const THRESHOLDS = require('./confidence-thresholds');

class ConfidenceCalculator {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.log = this.debug ? console.log.bind(console, '[Confidence]') : () => {};
  }

  /**
   * Calculate confidence score for an element finding operation
   * 
   * @param {Object} recipe - The ElementRecipe used
   * @param {Object} matchAnalysis - Analysis of matched elements
   * @param {Object} findResult - Result from SmartFinder (optional)
   * @returns {Object} Confidence result
   */
  calculate(recipe, matchAnalysis = {}, findResult = {}) {
    let score = THRESHOLDS.BASE_SCORE;
    const reasons = [];
    const deductions = [];

    // Factor 1: Match count
    const matchCount = matchAnalysis.totalMatches || 1;
    if (matchCount === 1) {
      score += THRESHOLDS.SCORES.SINGLE_MATCH;
      reasons.push('Single element match');
    } else if (matchCount > 1) {
      score += THRESHOLDS.SCORES.MULTIPLE_MATCHES;
      deductions.push(`${matchCount} elements matched`);
    }

    // Factor 2: TestId presence
    if (recipe.which?.testId) {
      score += THRESHOLDS.SCORES.UNIQUE_TESTID;
      reasons.push('Has data-testid');
    }

    // Factor 3: Unique ID (non-dynamic)
    if (recipe.which?.id && !this._isDynamicId(recipe.which.id)) {
      score += 15;
      reasons.push('Has stable ID');
    }

    // Factor 4: Related list context (Salesforce)
    if (recipe.where?.relatedList) {
      score += THRESHOLDS.SCORES.RELATED_LIST_CONTEXT;
      reasons.push(`relatedList: "${recipe.where.relatedList}"`);
    }

    // Factor 5: Aria label
    if (recipe.which?.ariaLabel) {
      score += THRESHOLDS.SCORES.HAS_ARIA_LABEL;
      reasons.push('Has aria-label');
    }

    // Factor 6: Strategy used (from findResult)
    const strategy = findResult.strategy || '';
    if (strategy.includes('testId')) {
      score += 15;
      reasons.push('Used testId strategy');
    } else if (strategy.includes('role+text')) {
      score += THRESHOLDS.SCORES.ROLE_TEXT_MATCH;
      reasons.push('Used role+text strategy');
    } else if (strategy.includes('position')) {
      score += THRESHOLDS.SCORES.POSITION_FALLBACK;
      deductions.push('Used position-based fallback');
    } else if (strategy.includes('AI') || strategy.includes('vision')) {
      score += THRESHOLDS.SCORES.AI_VISION_FALLBACK;
      deductions.push('Used AI vision fallback');
    } else if (strategy.includes('coordinate') || strategy.includes('DirectClick') || strategy.includes('boundingBox')) {
      score += THRESHOLDS.SCORES.COORDINATE_CLICK;
      deductions.push('Used coordinate-based click');
    }

    // Factor 7: Exact text match
    if (findResult.exactTextMatch) {
      score += THRESHOLDS.SCORES.EXACT_TEXT_MATCH;
      reasons.push('Exact text match');
    } else if (findResult.textMatched === false) {
      score += THRESHOLDS.SCORES.TEXT_PARTIAL_MATCH;
      deductions.push('Text partially matched');
    }

    // Factor 8: No unique identifier
    if (!recipe.which?.testId && !recipe.which?.id && !recipe.which?.ariaLabel) {
      score += THRESHOLDS.SCORES.NO_UNIQUE_IDENTIFIER;
      if (!deductions.some(d => d.includes('identifier'))) {
        deductions.push('No unique identifier');
      }
    }

    // Clamp score to 0-100
    score = Math.max(0, Math.min(100, score));

    // Determine level
    let level;
    if (score >= THRESHOLDS.HIGH_THRESHOLD) {
      level = THRESHOLDS.LEVELS.HIGH;
    } else if (score >= THRESHOLDS.MEDIUM_THRESHOLD) {
      level = THRESHOLDS.LEVELS.MEDIUM;
    } else {
      level = THRESHOLDS.LEVELS.LOW;
    }

    const result = {
      score: Math.round(score),
      level,
      reasons,
      deductions,
      recommendation: this._getRecommendation(level, deductions, recipe, matchAnalysis),
      matchCount,
      usedPosition: matchAnalysis.usedPosition || recipe.which?.position || 1
    };

    this.log('Calculated confidence:', result);
    return result;
  }

  /**
   * Calculate confidence during recording (less info available)
   */
  calculateForRecording(recipe) {
    const matchAnalysis = {
      totalMatches: recipe.which?.totalMatching || 1,
      usedPosition: recipe.which?.position || 1
    };
    
    return this.calculate(recipe, matchAnalysis, {});
  }

  /**
   * Check if an ID looks dynamic (generated)
   */
  _isDynamicId(id) {
    if (!id) return true;
    // Dynamic IDs often have patterns like: react-123, ember456, :r0:, etc.
    return /^(react-|ember|vue-|ng-|:r\d+:|[a-z]+-\d{4,}|[0-9a-f]{8,})/i.test(id);
  }

  /**
   * Generate recommendation based on confidence
   */
  _getRecommendation(level, deductions, recipe, matchAnalysis) {
    if (level === THRESHOLDS.LEVELS.HIGH) {
      return null;
    }

    const matchCount = matchAnalysis?.totalMatches || 1;

    if (matchCount > 1) {
      return `${matchCount} elements found. Add data-testid to the target element for reliable identification.`;
    }

    if (deductions.some(d => d.includes('position'))) {
      return 'Position-based selection is fragile. Element order may change. Add unique identifier.';
    }

    if (deductions.some(d => d.includes('AI') || d.includes('coordinate'))) {
      return 'Fallback strategy used. Re-record this step or use Element Repair to improve selector.';
    }

    if (deductions.some(d => d.includes('identifier'))) {
      return 'No unique identifier found. Consider adding data-testid to improve reliability.';
    }

    return 'Improve element identification for more reliable playback.';
  }

  /**
   * Summarize confidence across multiple steps
   */
  summarize(stepConfidences) {
    const summary = {
      total: stepConfidences.length,
      high: 0,
      medium: 0,
      low: 0,
      overallScore: 0,
      warnings: []
    };

    stepConfidences.forEach((conf, index) => {
      if (!conf) return;
      
      summary.overallScore += conf.score;
      
      if (conf.level === THRESHOLDS.LEVELS.HIGH) {
        summary.high++;
      } else if (conf.level === THRESHOLDS.LEVELS.MEDIUM) {
        summary.medium++;
        summary.warnings.push({
          step: index + 1,
          score: conf.score,
          level: conf.level,
          reason: conf.deductions[0] || 'Medium confidence'
        });
      } else {
        summary.low++;
        summary.warnings.push({
          step: index + 1,
          score: conf.score,
          level: conf.level,
          reason: conf.deductions[0] || 'Low confidence'
        });
      }
    });

    summary.overallScore = stepConfidences.length > 0 
      ? Math.round(summary.overallScore / stepConfidences.length)
      : 0;
    
    return summary;
  }

  /**
   * Check if a step should fail based on confidence and mode
   */
  shouldFail(confidence, mode = THRESHOLDS.EXECUTION_MODES.NORMAL) {
    if (mode === THRESHOLDS.EXECUTION_MODES.LENIENT) {
      return false;
    }
    
    if (mode === THRESHOLDS.EXECUTION_MODES.STRICT) {
      return confidence.level !== THRESHOLDS.LEVELS.HIGH;
    }
    
    // Normal mode: fail on LOW
    return confidence.level === THRESHOLDS.LEVELS.LOW;
  }
}

module.exports = ConfidenceCalculator;
