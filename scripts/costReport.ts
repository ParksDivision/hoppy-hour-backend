import { cloudflareS3Service } from '../src/utils/cloudflareS3Service';
import { logger } from '../src/utils/logger/logger';
import prisma from '../src/prismaClient';

async function generateCostReport() {
  try {
    console.log('📊 Generating S3 Cost Report...\n');
    
    // Get comprehensive cost report
    const report = await cloudflareS3Service.getCostReport();
    const stats = await cloudflareS3Service.getUsageStats();
    
    console.log('='.repeat(60));
    console.log('           HOPPY HOUR S3 COST REPORT');
    console.log('='.repeat(60));
    
    // Budget Overview
    console.log('\n💰 BUDGET OVERVIEW');
    console.log('-'.repeat(40));
    console.log(`Current Month Spending: $${report.currentMonth.total.toFixed(2)}`);
    console.log(`Remaining Budget:       $${report.remainingBudget.toFixed(2)}`);
    console.log(`Daily Average:          $${report.dailyAverage.toFixed(2)}`);
    console.log(`Projected Monthly:      $${report.projectedMonthly.toFixed(2)}`);
    console.log(`Emergency Mode:         ${report.emergencyMode ? '🚨 ACTIVE' : '✅ Normal'}`);
    
    // Cost Breakdown
    console.log('\n💸 COST BREAKDOWN');
    console.log('-'.repeat(40));
    console.log(`S3 Storage:             $${report.currentMonth.s3Storage.toFixed(2)}`);
    console.log(`S3 Requests:            $${report.currentMonth.s3Requests.toFixed(2)}`);
    console.log(`S3 Data Transfer:       $${report.currentMonth.s3DataTransfer.toFixed(2)}`);
    console.log(`Cloudflare Requests:    $${report.currentMonth.cloudflareRequests.toFixed(2)}`);
    console.log(`Cloudflare Bandwidth:   $${report.currentMonth.cloudflareBandwidth.toFixed(2)}`);
    
    // Usage Statistics
    console.log('\n📈 USAGE STATISTICS');
    console.log('-'.repeat(40));
    console.log(`Total Operations:       ${stats.totalOperations}`);
    console.log(`Operations by Type:`);
    Object.entries(stats.operationsByType).forEach(([type, count]) => {
      console.log(`  ${type.padEnd(12)}: ${count}`);
    });
    
    // Cloudflare CDN Stats
    console.log('\n☁️  CLOUDFLARE CDN USAGE');
    console.log('-'.repeat(40));
    console.log(`CDN Requests:           ${report.cloudflareStats.requestsUsed.toLocaleString()}`);
    console.log(`CDN Bandwidth:          ${report.cloudflareStats.bandwidthUsed.toFixed(2)} GB`);
    
    // Cost Trends (last 7 days)
    console.log('\n📊 DAILY COST TREND (Last 7 Days)');
    console.log('-'.repeat(40));
    const recentCosts = stats.costByDay.slice(-7);
    recentCosts.forEach(day => {
      console.log(`${day.date}: $${day.cost.toFixed(2)}`);
    });
    
    // Top Expensive Operations
    if (stats.topExpensiveOperations.length > 0) {
      console.log('\n💎 TOP EXPENSIVE OPERATIONS');
      console.log('-'.repeat(40));
      stats.topExpensiveOperations.slice(0, 5).forEach((op, i) => {
        console.log(`${i + 1}. ${op.type} - $${op.cost.toFixed(4)} (${op.timestamp.toLocaleDateString()})`);
      });
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('-'.repeat(40));
    
    if (report.emergencyMode) {
      console.log('🚨 Emergency mode is active - only CDN URLs are being served');
      console.log('   Consider running: npm run cost:reset');
    } else if (report.projectedMonthly > 20) {
      console.log('⚠️  Projected monthly cost exceeds budget');
      console.log('   Consider reducing image processing or increasing CDN usage');
    } else if (report.currentMonth.s3Requests > report.currentMonth.cloudflareRequests) {
      console.log('📈 High S3 request costs detected');
      console.log('   Ensure CDN is properly configured and being used');
    } else {
      console.log('✅ Cost management is working well');
      console.log('   CDN is effectively reducing S3 costs');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`Report generated at: ${new Date().toLocaleString()}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    logger.error('Failed to generate cost report', { error });
    console.error('❌ Failed to generate cost report:', error);
    process.exit(1);
  }
}

// Run the report
generateCostReport()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));