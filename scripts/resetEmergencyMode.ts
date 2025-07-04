import prisma from '../src/prismaClient';

export async function resetEmergencyMode() {
  try {
    const monthYear = new Date().toISOString().slice(0, 7);
    
    const budget = await prisma.costBudget.update({
      where: { monthYear },
      data: {
        budgetExceeded: false,
        alertSent: false
      }
    });

    console.log('✅ Emergency mode has been reset');
    console.log(`Monthly budget: $${budget.totalBudget}`);
    console.log(`Current spending: $${budget.currentSpent}`);
    console.log('⚠️  Please monitor costs closely');
    
    return budget;
  } catch (error) {
    console.error('❌ Failed to reset emergency mode:', error);
    throw error;
  }
}

// Run reset if called directly
if (require.main === module) {
  resetEmergencyMode()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}