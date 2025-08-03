import dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import * as entities from './src/entities';
import { MessagesService } from './src/services/messages.service';

// Load environment variables
dotenv.config();

// Create separate DataSource instance for testing
const TestDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
    logging: false,
    entities: Object.values(entities),
});

/**
 * Test script to verify getRecentMessages output
 * Tests with session ID: 58e5359b-596d-4cfb-8541-f589b31358c7
 */
async function testRecentMessages() {
    console.log('🚀 Starting Recent Messages Test');
    console.log('=' .repeat(50));

    try {
        // Initialize database connection
        console.log('📊 Initializing database connection...');
        await TestDataSource.initialize();
        console.log('✅ Database connected successfully\n');

        // Create repository directly for testing
        const messageRepository = TestDataSource.getRepository(entities.Message);
        const sessionId = '58e5359b-596d-4cfb-8541-f589b31358c7';

        console.log(`🔍 Testing getRecentMessages for session: ${sessionId}`);
        console.log('-'.repeat(50));

        // Test with limit of 10 (replicating the getRecentMessages logic)
        const recentMessages = await messageRepository.find({
            where: { chat_session_id: sessionId },
            order: { created_at: 'DESC' },
            take: 10
        });

        console.log(`📝 Found ${recentMessages.length} recent messages:\n`);

        if (recentMessages.length === 0) {
            console.log('⚠️  No messages found for this session ID');
        } else {
            // Display messages in a nice format
            recentMessages.forEach((message, index) => {
                console.log(`Message #${index + 1}`);
                console.log(`  ID: ${message.id}`);
                console.log(`  Session ID: ${message.chat_session_id}`);
                console.log(`  Type: ${message.type}`);
                console.log(`  Created: ${message.created_at}`);
                console.log(`  User Message: ${message.user_message ? message.user_message.substring(0, 100) + (message.user_message.length > 100 ? '...' : '') : 'N/A'}`);
                console.log(`  AI Response: ${message.ai_response ? message.ai_response.substring(0, 100) + (message.ai_response.length > 100 ? '...' : '') : 'N/A'}`);
                console.log('  ' + '-'.repeat(40));
            });

            // Test ordering (should be DESC by created_at)
            console.log('\n📅 Message Order Verification:');
            for (let i = 0; i < recentMessages.length - 1; i++) {
                const current = new Date(recentMessages[i].created_at);
                const next = new Date(recentMessages[i + 1].created_at);
                const isCorrectOrder = current >= next;
                console.log(`  Message ${i + 1} → ${i + 2}: ${isCorrectOrder ? '✅' : '❌'} (${current.toISOString()} vs ${next.toISOString()})`);
            }
        }

        // Also test the total message count for context
        console.log('\n📊 Additional Context:');
        const totalCount = await messageRepository.count({
            where: { chat_session_id: sessionId }
        });
        console.log(`  Total messages in session: ${totalCount}`);
        console.log(`  Requested limit: 10`);
        console.log(`  Actual returned: ${recentMessages.length}`);

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        // Close database connection
        if (TestDataSource.isInitialized) {
            await TestDataSource.destroy();
            console.log('\n🔌 Database connection closed');
        }
        console.log('🏁 Test completed');
    }
}

// Run the test
testRecentMessages().catch(console.error);