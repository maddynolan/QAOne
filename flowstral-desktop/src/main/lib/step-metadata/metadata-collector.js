/**
 * Metadata Collector
 * 
 * Collects comprehensive metadata for each recorded step.
 * This metadata is used for confidence scoring and debugging.
 * 
 * @author Flowstral QA Team
 * @version 1.0.0
 */

const MatchAnalyzer = require('./match-analyzer');
const FingerprintGenerator = require('./fingerprint-generator');

class MetadataCollector {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.log = this.debug ? console.log.bind(console, '[Metadata]') : () => {};
    this.matchAnalyzer = new MatchAnalyzer({ debug: this.debug });
    this.fingerprintGenerator = new FingerprintGenerator({ debug: this.debug });
  }

  /**
   * Collect all metadata for a step (during recording)
   * 
   * @param {Page} page - Playwright page
   * @param {Object} recipeAction - The recorded action with recipe
   * @returns {Object} Step metadata
   */
  async collect(page, recipeAction) {
    const recipe = recipeAction.target || recipeAction.recipe || recipeAction;
    const startTime = Date.now();
    
    try {
      const [matchAnalysis, fingerprint] = await Promise.all([
        this.matchAnalyzer.analyzeForRecording(page, recipe),
        this.fingerprintGenerator.generate(page, recipe)
      ]);

      const metadata = {
        matchAnalysis,
        fingerprint,
        collectedAt: Date.now(),
        collectDuration: Date.now() - startTime,
        isAmbiguous: this.matchAnalyzer.isAmbiguous(matchAnalysis.matchDetails)
      };

      this.log('Collected metadata for step:', {
        matches: matchAnalysis.totalMatches,
        ambiguous: metadata.isAmbiguous
      });

      return metadata;
    } catch (e) {
      this.log(`Metadata collection failed: ${e.message}`);
      return {
        matchAnalysis: { totalMatches: 1, usedPosition: 1 },
        fingerprint: null,
        error: e.message,
        collectedAt: Date.now()
      };
    }
  }

  /**
   * Collect metadata during playback (more detailed)
   */
  async collectForPlayback(page, action, findResult) {
    const recipe = action.target || action.recipe || action;
    const startTime = Date.now();
    
    try {
      const matchAnalysis = await this.matchAnalyzer.analyze(page, recipe);
      const fingerprint = await this.fingerprintGenerator.generate(page, recipe);

      return {
        matchAnalysis,
        fingerprint,
        findResult: {
          strategy: findResult.strategy,
          exactTextMatch: findResult.exactTextMatch,
          fallbacksUsed: findResult.fallbacksUsed || []
        },
        collectedAt: Date.now(),
        collectDuration: Date.now() - startTime,
        isAmbiguous: this.matchAnalyzer.isAmbiguous(matchAnalysis.matchDetails)
      };
    } catch (e) {
      this.log(`Playback metadata collection failed: ${e.message}`);
      return {
        matchAnalysis: { totalMatches: 1, usedPosition: 1 },
        findResult,
        error: e.message,
        collectedAt: Date.now()
      };
    }
  }

  /**
   * Quick metadata for simple actions (no page needed)
   */
  collectSimple(action) {
    const recipe = action.target || action.recipe || action;
    
    return {
      matchAnalysis: {
        totalMatches: recipe.which?.totalMatching || 1,
        usedPosition: recipe.which?.position || 1,
        hasRelatedListContext: !!recipe.where?.relatedList,
        isUnique: (recipe.which?.totalMatching || 1) === 1
      },
      fingerprint: this.fingerprintGenerator.generate(null, recipe),
      collectedAt: Date.now()
    };
  }

  /**
   * Merge recording metadata with playback data
   */
  mergeWithPlayback(recordingMetadata, playbackData) {
    return {
      recording: recordingMetadata,
      playback: playbackData,
      comparison: {
        matchCountChanged: recordingMetadata.matchAnalysis?.totalMatches !== 
                          playbackData.matchAnalysis?.totalMatches,
        positionChanged: recordingMetadata.matchAnalysis?.usedPosition !== 
                        playbackData.matchAnalysis?.usedPosition
      }
    };
  }
}

module.exports = MetadataCollector;
