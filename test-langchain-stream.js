const { ChatOpenAI } = require('@langchain/openai');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { JsonOutputParser } = require('@langchain/core/output_parsers');

async function testLangChainStreaming() {
    console.log('🧪 Testing LangChain Streaming with Structured Output...\n');

    try {
        // Create OpenAI model
        const model = new ChatOpenAI({
            streaming: true,
            model: 'gpt-4o-mini',
            temperature: 0.7,
        });


        // Create structured output parser
        const parser = new JsonOutputParser();

        // Create prompt template with system and human messages
        const prompt = ChatPromptTemplate.fromMessages([
            [
                'system',
                `You are a JSON content generator. Your ONLY task is to return valid JSON.

CRITICAL RULES:
1. Return ONLY valid JSON - no explanations, no markdown, no code blocks
2. Do NOT wrap JSON in \`\`\`json or any other formatting
3. Do NOT add any text before or after the JSON
4. Start your response directly with an opening brace and end with a closing brace
5. Ensure all strings are properly quoted
6. Ensure all arrays and objects are properly formatted

If you include anything other than pure JSON, the system will fail.`
            ],
            [
                'human',
                `Generate content about: {topic}

Return a JSON object

REQUIREMENTS:
- title: Catchy, engaging title (string)
- content: Comprehensive content (string, minimum 100 characters)
- tags: Array of 3-5 relevant tags (strings only)
- priority: MUST be exactly "low", "medium", or "high"

Remember: Return ONLY the JSON object, nothing else.

{format_instructions}`
            ]
        ]);

        // Create chain
        const chain = prompt.pipe(model).pipe(parser);

        console.log('⏳ Starting streaming...');

        // Start streaming
        const stream = await chain.stream({
            topic: 'Benefits of using PHP in modern web development',
            format_instructions: 'Return only valid JSON with the structure shown above'
        });

        console.log('🔄 Processing streaming chunks...\n');

        let chunkCount = 0;
        let finalResult = null;

        for await (const chunk of stream) {
            chunkCount++;
            console.log(`📦 Chunk ${chunkCount}:`, JSON.stringify(chunk, null, 2));
            console.log(chunk.title)
            finalResult = chunk;
        }


        return { success: true, result: finalResult, chunkCount };

    } catch (error) {
        console.error('❌ Streaming test failed:', error.message);
        console.error('Stack:', error.stack);
        return { success: false, error: error.message };
    }
}

// Run the test
if (require.main === module) {
    // Check if OpenAI API key is available
    // if (!process.env.OPENAI_API_KEY) {
    //     console.error('❌ Please set OPENAI_API_KEY environment variable');
    //     process.exit(1);
    // }

    testLangChainStreaming()
        .then((result) => {
            if (result.success) {
                console.log('\n🎉 Test completed successfully!');
                process.exit(0);
            } else {
                console.log('\n💥 Test failed');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('💥 Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = { testLangChainStreaming };