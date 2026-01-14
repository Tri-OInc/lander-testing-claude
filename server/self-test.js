/**
 * Self-test script for Website Cloner
 * Clones example.com and verifies the output
 */

const path = require('path');
const fs = require('fs');
const { WebsiteCloner } = require('./cloner');

const TEST_URL = 'https://example.com';

async function runSelfTest() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           Website Cloner - Self Test                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  const cloner = new WebsiteCloner({
    headless: true,
    emit: (event, data) => {
      if (event === 'log' && data.type !== 'network') {
        console.log(`[${data.type}] ${data.message}`);
      }
    }
  });

  console.log(`Testing clone of: ${TEST_URL}\n`);

  try {
    const result = await cloner.clone(TEST_URL);

    console.log('\n--- Test Results ---\n');

    // Check 1: Clone success
    const test1 = result.success;
    console.log(`✓ Clone completed: ${test1 ? 'PASS' : 'FAIL'}`);

    if (!result.success) {
      console.log(`  Error: ${result.error}`);
      process.exit(1);
    }

    // Check 2: Output folder exists
    const test2 = fs.existsSync(result.outputPath);
    console.log(`✓ Output folder exists: ${test2 ? 'PASS' : 'FAIL'}`);

    // Check 3: index.html exists
    const indexPath = path.join(result.outputPath, 'index.html');
    const test3 = fs.existsSync(indexPath);
    console.log(`✓ index.html exists: ${test3 ? 'PASS' : 'FAIL'}`);

    // Check 4: index.html has content
    const htmlContent = test3 ? fs.readFileSync(indexPath, 'utf-8') : '';
    const test4 = htmlContent.length > 100;
    console.log(`✓ index.html has content (${htmlContent.length} bytes): ${test4 ? 'PASS' : 'FAIL'}`);

    // Check 5: Assets folder exists
    const assetsPath = path.join(result.outputPath, 'assets');
    const test5 = fs.existsSync(assetsPath);
    console.log(`✓ Assets folder exists: ${test5 ? 'PASS' : 'FAIL'}`);

    // Check 6: At least 1 asset downloaded (if any assets exist on the page)
    let assetCount = 0;
    if (test5) {
      const assetTypes = ['css', 'js', 'images', 'fonts', 'other'];
      for (const type of assetTypes) {
        const typePath = path.join(assetsPath, type);
        if (fs.existsSync(typePath)) {
          const files = fs.readdirSync(typePath);
          assetCount += files.length;
        }
      }
    }
    console.log(`✓ Assets downloaded: ${assetCount} file(s)`);

    // Check 7: HTML contains expected content
    const test7 = htmlContent.includes('Example Domain');
    console.log(`✓ HTML contains expected content: ${test7 ? 'PASS' : 'FAIL'}`);

    // Summary
    const allPassed = test1 && test2 && test3 && test4 && test5 && test7;
    console.log('\n--- Summary ---\n');

    if (allPassed) {
      console.log('✅ All tests PASSED!');
      console.log(`\nClone saved to: ${result.outputPath}`);
      console.log(`Open URL would be: ${result.openUrl}`);
      process.exit(0);
    } else {
      console.log('❌ Some tests FAILED');
      process.exit(1);
    }

  } catch (err) {
    console.error('\n❌ Test failed with error:', err.message);
    process.exit(1);
  }
}

// Run the test
runSelfTest();
