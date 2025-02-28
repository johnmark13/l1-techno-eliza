import {
  type Action,
  ChannelType,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelClass,
  RoleName,
  type State,
  composeContext,
  generateText,
  getWorldSettings,
  logger,
  normalizeUserId,
  stringToUuid
} from "@elizaos/core";

/**
 * Gets a user's role from world metadata
 */
export async function getUserServerRole(
  runtime: IAgentRuntime,
  userId: string,
  serverId: string
): Promise<RoleName> {
  try {
    const worldId = stringToUuid(`${serverId}-${runtime.agentId}`);
    const world = await runtime.getWorld(worldId);

    // Log the world metadata for debugging
    logger.info(`Checking user role for userId: ${userId} in server: ${serverId}`);
    logger.info(`World metadata: ${JSON.stringify(world?.metadata || {})}`);

    if (!world || !world.metadata) {
      logger.info(`No world or metadata found for worldId: ${worldId}`);
      return RoleName.NONE;
    }

    // Check both formats (UUID and original ID)
    const normalizedUserId = normalizeUserId(userId);
    // Ensure userId is in UUID format before passing to generateTenantUserId
    const tenantSpecificUserId = runtime.generateTenantUserId(stringToUuid(userId));
    logger.info(`Normalized userId: ${normalizedUserId}, Original userId: ${userId}, Tenant-specific userId: ${tenantSpecificUserId}`);

    // First check if user is the owner by checking ownership metadata
    if (world.metadata.ownership) {
      const ownerId = world.metadata.ownership.ownerId;
      logger.info(`Owner ID from metadata: ${ownerId}`);
      
      if (ownerId === normalizedUserId || ownerId === userId || ownerId === tenantSpecificUserId) {
        logger.info(`User ${userId} is the owner of server ${serverId}`);
        return RoleName.OWNER;
      }
    }

    // Check in roles object (could be string or object format)
    if (world.metadata.roles) {
      // Check for tenant-specific user ID first (most likely format)
      if (world.metadata.roles[tenantSpecificUserId]) {
        const role = world.metadata.roles[tenantSpecificUserId];
        logger.info(`Found role for tenant-specific ID ${tenantSpecificUserId}: ${role}`);
        return typeof role === 'string' ? role as RoleName : RoleName.NONE;
      }
      
      // Check for normalized user ID
      if (world.metadata.roles[normalizedUserId]) {
        const role = world.metadata.roles[normalizedUserId];
        logger.info(`Found role for normalized ID ${normalizedUserId}: ${role}`);
        return typeof role === 'string' ? role as RoleName : RoleName.NONE;
      }
      
      // Check for original user ID
      if (world.metadata.roles[userId]) {
        const role = world.metadata.roles[userId];
        logger.info(`Found role for original ID ${userId}: ${role}`);
        return typeof role === 'string' ? role as RoleName : RoleName.NONE;
      }
    }

    logger.info(`No role found for user ${userId} in server ${serverId}`);
    return RoleName.NONE;
  } catch (error) {
    logger.error(`Error getting user role: ${error}`);
    return RoleName.NONE;
  }
}

const tweetGenerationTemplate = `# Task: Create a post in the style and voice of {{agentName}}.
{{system}}

About {{agentName}}:
{{bio}}

{{topics}}

{{characterPostExamples}}

Recent Context:
{{recentMessages}}

# Instructions: Write a tweet that captures the essence of what {{agentName}} wants to share. The tweet should be:
- Under 280 characters
- In {{agentName}}'s authentic voice and style
- Related to the ongoing conversation or context
- Not include hashtags unless specifically requested
- Natural and conversational in tone

Return only the tweet text, no additional commentary.`;

// Required Twitter configuration fields that must be present
const REQUIRED_TWITTER_FIELDS = [
  "TWITTER_USERNAME",
  "TWITTER_EMAIL",
  "TWITTER_PASSWORD",
];

/**
 * Validates that all required Twitter configuration fields are present and non-null
 */
async function validateTwitterConfig(
  runtime: IAgentRuntime,
  serverId: string
): Promise<{ isValid: boolean; error?: string }> {
  try {
    const worldSettings = await getWorldSettings(runtime, serverId);

    if (!worldSettings) {
      return {
        isValid: false,
        error: "No settings state found for this server",
      };
    }

    // Check required fields
    for (const field of REQUIRED_TWITTER_FIELDS) {
      if (!worldSettings[field] || worldSettings[field].value === null) {
        return {
          isValid: false,
          error: `Missing required Twitter configuration: ${field}`,
        };
      }
    }

    return { isValid: true };
  } catch (error) {
    logger.error("Error validating Twitter config:", error);
    return {
      isValid: false,
      error: "Error validating Twitter configuration",
    };
  }
}

/**
 * Ensures a Twitter client exists for the given server and agent
 */
async function ensureTwitterClient(
  runtime: IAgentRuntime,
  serverId: string,
  worldSettings: { [key: string]: string | boolean | number | null }
) {
  const manager = runtime.getClient("twitter");
  if (!manager) {
    throw new Error("Twitter client manager not found");
  }

  let client = manager.getClient(serverId, runtime.agentId);

  if (!client) {
    logger.info("Creating new Twitter client for server", serverId);
    client = await manager.createClient(runtime, serverId, worldSettings);
    if (!client) {
      throw new Error("Failed to create Twitter client");
    }
  }

  return client;
}

const twitterPostAction: Action = {
  name: "TWITTER_POST",
  similes: ["POST_TWEET", "SHARE_TWEET", "TWEET_THIS", "TWEET_ABOUT"],
  description: "Creates and posts a tweet based on the conversation context",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State
  ): Promise<boolean> => {
    const room = await runtime.getRoom(message.roomId);
    if (!room) {
      throw new Error("No room found");
    }

    if (room.type !== ChannelType.GROUP) {
      // only handle in a group scenario for now
      return false;
    }

    const serverId = room.serverId;

    if (!serverId) {
      throw new Error("No server ID found");
    }

    // Validate Twitter configuration
    const validation = await validateTwitterConfig(runtime, serverId);
    if (!validation.isValid) {
      return false;
    }

    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ) => {
    try {
      const room = await runtime.getRoom(message.roomId);
      if (!room) {
        throw new Error("No room found");
      }

      if (room.type !== ChannelType.GROUP) {
        // only handle in a group scenario for now
        return false;
      }

      const serverId = room.serverId;

      if (!serverId) {
        throw new Error("No server ID found");
      }

      // Get settings state from world metadata
      const worldSettings = await getWorldSettings(runtime, serverId);
      if (!worldSettings) {
        throw new Error("Twitter not configured for this server");
      }

      // Generate tweet content
      const context = composeContext({
        state,
        template: tweetGenerationTemplate,
      });

      const tweetContent = await generateText({
        runtime,
        context,
        modelClass: ModelClass.TEXT_SMALL,
      });

      // Clean up the generated content
      const cleanTweet = tweetContent
        .trim()
        .replace(/^["'](.*)["']$/, "$1")
        .replace(/\\n/g, "\n");

      const userRole = await getUserServerRole(
        runtime,
        message.userId,
        serverId
      );
      if (!userRole) {
        // callback and return
        await callback({
          text: "I'm sorry, but you're not authorized to post tweets on behalf of this org.",
          action: "TWITTER_POST_FAILED",
          source: message.content.source,
        });
        return;
      }

      // Check if there are any pending Twitter posts awaiting confirmation
      const pendingTasks = runtime.getTasks({
        roomId: message.roomId,
        tags: ["AWAITING_CONFIRMATION", "TWITTER_POST"],
      });

      if (pendingTasks && pendingTasks.length > 0) {
        for (const task of pendingTasks) {
          await runtime.deleteTask(task.id);
        }
      }

      // Prepare response content with proper typing
      const responseContent: Content & { imageUrl?: string } = {
        text: `Here's a tweet I've drafted based on our conversation:\n\n"${cleanTweet}"`,
        action: "TWITTER_POST",
        source: message.content.source,
      };

      // Check if there's a stored image for this server
      let imageData: { url: string; description: string; name?: string; timestamp: number } | null = null;

      // First check if the message mentions a specific image by name
      const imageMentionMatch = message.content.text.match(/(?:with|using|include|attach)\s+(?:the\s+)?(?:image|picture)\s+(?:called|named)?\s*["']?([^"'.,!?]+)["']?/i);
      if (imageMentionMatch && imageMentionMatch[1]) {
        const requestedImageName = imageMentionMatch[1].trim();
        const safeImageName = requestedImageName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        
        try {
          // Try to get the image by name
          const namedImageData = await runtime.cacheManager.get<string>(`social_media_image_${serverId}_${safeImageName}`);
          if (namedImageData) {
            imageData = JSON.parse(namedImageData) as { url: string; description: string; name: string; timestamp: number };
            logger.info(`Found image by name "${requestedImageName}": ${imageData.url}`);
          } else {
            // If not found by exact name, try to find the most recent image
            const cachedImageData = await runtime.cacheManager.get<string>(`social_media_image_${serverId}`);
            if (cachedImageData) {
              const parsedData = JSON.parse(cachedImageData);
              if (parsedData && typeof parsedData === 'object' && 'url' in parsedData && typeof parsedData.url === 'string') {
                imageData = parsedData as { url: string; description: string; name?: string; timestamp: number };
                logger.info(`Could not find image named "${requestedImageName}", using most recent image instead: ${imageData.url}`);
              }
            }
          }
        } catch (error) {
          logger.error(`Error retrieving image by name: ${error}`);
        }
      } else {
        // Check for user-uploaded image URL in the message
        const urlMatch = message.content.text.match(/https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)/i);
        if (urlMatch && urlMatch[0]) {
          const imageUrl = urlMatch[0];
          logger.info(`Found user-uploaded image URL in message: ${imageUrl}`);
          imageData = {
            url: imageUrl,
            description: "User-provided image",
            timestamp: Date.now()
          };
        } else {
          // If no specific image mentioned or URL provided, try to get the most recent image
          try {
            const cachedImageData = await runtime.cacheManager.get<string>(`social_media_image_${serverId}`);
            if (cachedImageData) {
              const parsedData = JSON.parse(cachedImageData);
              if (parsedData && typeof parsedData === 'object' && 'url' in parsedData && typeof parsedData.url === 'string') {
                imageData = parsedData as { url: string; description: string; name?: string; timestamp: number };
                logger.info(`Using most recent image: ${imageData.url}`);
              }
            }
          } catch (error) {
            logger.error(`Error retrieving cached image: ${error}`);
          }
        }
      }

      // Add image context to the response if an image was found
      if (imageData) {
        const imageName = imageData.name ? `"${imageData.name}"` : "the attached image";
        responseContent.text += `\n\nI'll attach ${imageName} to this tweet.`;
        responseContent.imageUrl = imageData.url;
      }

      // Register approval task
      runtime.registerTask({
        roomId: message.roomId,
        name: "Confirm Twitter Post",
        description: "Confirm the tweet to be posted.",
        tags: ["TWITTER_POST", "AWAITING_CONFIRMATION"],
        handler: async (runtime: IAgentRuntime) => {
          const vals = {
            TWITTER_USERNAME: worldSettings.TWITTER_USERNAME.value,
            TWITTER_EMAIL: worldSettings.TWITTER_EMAIL.value,
            TWITTER_PASSWORD: worldSettings.TWITTER_PASSWORD.value,
            TWITTER_2FA_SECRET:
              worldSettings.TWITTER_2FA_SECRET.value ?? undefined,
          };

          // Initialize/get Twitter client
          const client = await ensureTwitterClient(runtime, serverId, vals);

          // Create tweet with or without media
          let result;
          if (imageData && imageData.url) {
            // Upload the image and get the media ID
            const mediaId = await client.client.twitterClient.uploadMedia(imageData.url);
            
            // Create tweet with media
            result = await client.client.twitterClient.sendTweet({
              text: cleanTweet,
              media: {
                media_ids: [mediaId]
              }
            });
          } else {
            // Create tweet without media
            result = await client.client.twitterClient.sendTweet(cleanTweet);
          }

          // result is a response object, get the data from it-- body is a readable stream
          const data = await result.json();

          const tweetId =
            data?.data?.create_tweet?.tweet_results?.result?.rest_id;

          const tweetUrl = `https://twitter.com/${vals.TWITTER_USERNAME}/status/${tweetId}`;

          await callback({
            ...responseContent,
            text: `${tweetUrl}`,
            url: tweetUrl,
            tweetId,
          });
        },
        validate: async (
          runtime: IAgentRuntime,
          message: Memory,
          _state: State
        ) => {
          const userRole = await getUserServerRole(
            runtime,
            message.userId,
            serverId
          );
          if (!userRole) {
            return false;
          }

          return userRole === "OWNER" || userRole === "ADMIN";
        },
      });

      responseContent.text += "\nWaiting for approval from ";
      responseContent.text +=
        userRole === "OWNER" ? "an admin" : "an admin or boss";

      await callback({
        ...responseContent,
        action: "TWITTER_POST_TASK_NEEDS_CONFIRM",
      });
      return responseContent;
    } catch (error) {
      logger.error("Error in TWITTER_POST action:", error);
      throw error;
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "That's such a great point about neural networks! You should tweet that",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I'll tweet this:\n\nDeep learning isn't just about layers - it's about understanding how neural networks actually learn from patterns. The magic isn't in the math, it's in the emergent behaviors we're just beginning to understand.",
          action: "TWITTER_POST",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Can you share this insight on Twitter?",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Tweet posted!\nhttps://twitter.com/username/status/123456789",
          action: "TWITTER_POST",
        },
      },
    ],
  ],
};

export default twitterPostAction;