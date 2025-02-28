import {
  type Action,
  ChannelType,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  RoleName,
  type State,
  getWorldSettings,
  logger,
} from "@elizaos/core";
import { getUserServerRole } from "./post";

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
  worldSettings: { [key: string]: any }
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

const twitterDeleteAction: Action = {
  name: "TWITTER_DELETE",
  similes: ["DELETE_TWEET", "REMOVE_TWEET", "DELETE_POST", "REMOVE_POST"],
  description: "Deletes a tweet based on its ID",

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

    // Check if the message content contains a tweet ID or URL
    const content = message.content.text.toLowerCase();
    return content.includes("delete") && 
           (content.includes("tweet") || content.includes("post")) && 
           (content.includes("twitter.com") || /\d{18,20}/.test(content));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback
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

      // Check user role
      const userRole = await getUserServerRole(
        runtime,
        message.userId,
        serverId
      );
      
      if (userRole !== RoleName.OWNER && userRole !== RoleName.ADMIN) {
        await callback({
          text: "I'm sorry, but you're not authorized to delete tweets on behalf of this org.",
          action: "TWITTER_DELETE_FAILED",
          source: message.content.source,
        });
        return;
      }

      // Extract tweet ID from message
      const tweetIdMatch = message.content.text.match(/twitter\.com\/\w+\/status\/(\d+)/) || 
                          message.content.text.match(/(\d{18,20})/);
      
      if (!tweetIdMatch || !tweetIdMatch[1]) {
        await callback({
          text: "I couldn't find a valid tweet ID to delete. Please provide a tweet URL or ID.",
          action: "TWITTER_DELETE_FAILED",
          source: message.content.source,
        });
        return;
      }
      
      const tweetId = tweetIdMatch[1];
      
      // Initialize Twitter client
      const vals = {
        TWITTER_USERNAME: worldSettings.TWITTER_USERNAME.value,
        TWITTER_EMAIL: worldSettings.TWITTER_EMAIL.value,
        TWITTER_PASSWORD: worldSettings.TWITTER_PASSWORD.value,
        TWITTER_2FA_SECRET: worldSettings.TWITTER_2FA_SECRET?.value ?? undefined,
      };

      const client = await ensureTwitterClient(runtime, serverId, vals);

      // Delete the tweet
      try {
        await client.client.twitterClient.deleteTweet(tweetId);
        
        await callback({
          text: `I've successfully deleted the tweet with ID: ${tweetId}.`,
          action: "TWITTER_DELETE_SUCCESS",
          source: message.content.source,
        });
      } catch (error) {
        logger.error(`Error deleting tweet: ${error}`);
        await callback({
          text: `I couldn't delete the tweet. Error: ${error}`,
          action: "TWITTER_DELETE_FAILED",
          source: message.content.source,
        });
      }
    } catch (error) {
      logger.error("Error in TWITTER_DELETE action:", error);
      throw error;
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Can you delete this tweet? https://twitter.com/username/status/1234567890123456789",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I've successfully deleted the tweet with ID: 1234567890123456789.",
          action: "TWITTER_DELETE_SUCCESS",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Delete the tweet with ID 1234567890123456789",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I've successfully deleted the tweet with ID: 1234567890123456789.",
          action: "TWITTER_DELETE_SUCCESS",
        },
      },
    ],
  ],
};

export default twitterDeleteAction; 