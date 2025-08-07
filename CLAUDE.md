## Memories
- Added memory placeholder to memorize
- `to memorize`
- Memorize what we are doing right now to complete it again, the target is to enhance the scraping service, and to enhance the post service to reduce the number of lines and make it more readable
- Finished enhancing the content aggregation and the post service:
  * Refactored post service to improve readability and reduce code complexity
  * Optimized content aggregation workflow
  * Implemented more efficient data processing methods
  * Reduced overall lines of code while maintaining functionality
  * Improved modular structure of the post-related services

## Project Context
- **Backend-only application** - No frontend work required
- **Always update Swagger documentation** when APIs are modified
- Focus only on backend implementation and API documentation updates

## Task Management Rules
- **ALWAYS use the memory-task-manager agent** for any task management operations
- Task management operations include: creating tasks, updating tasks, completing tasks, listing tasks, setting current tasks
- Use format: @agent-memory-task-manager when delegating task management
- Never handle task management directly - always delegate to the specialized agent