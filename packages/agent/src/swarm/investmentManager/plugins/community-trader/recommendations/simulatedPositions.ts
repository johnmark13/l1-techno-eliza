import {
    Action,
    composeContext,
    elizaLogger,
    generateText,
    ModelClass,
    ServiceType,
    UUID,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
} from "@elizaos/core";
import { TrustScoreDatabase } from "../db";
import { TrustScoreManager } from "../scoreManager";
import { TrustTokenProvider } from "../tokenProvider";
import { TokenPerformance } from "../types";
import { formatFullReport } from "../reports";
import { db as trustDb } from "@ai16z/db";

export const getSimulatedPositions: Action = {
    name: "TRUST_GET_SIMULATED_POSITIONS",
    description:
        "Retrieves and formats position data for the agent's portfolio",
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "{{agentName}} show me my simulated positions",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "<NONE>",
                    action: "TRUST_GET_SIMULATED_POSITIONS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "{{agentName}} show me simulated positions",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "<NONE>",
                    action: "TRUST_GET_SIMULATED_POSITIONS",
                },
            },
        ],
    ],
    similes: ["GET_SIMULATED_POSITIONS", "SHOW_SIMULATED_PORTFOLIO"],

    async handler(runtime, message, state, options, callback: any) {
        console.log("getSimulatedPositions is running");

        try {
            const db = new TrustScoreDatabase(trustDb);

            const scoreManager = new TrustScoreManager(
                db,
                new TrustTokenProvider(runtime)
            );
            const [positions, user] = await Promise.all([
                db.getOpenPositionsWithBalance(),
                runtime.databaseAdapter.getEntityById(message.userId),
            ]);

            if (!user) {
                elizaLogger.error(
                    "No User Found, no recommender score can be generated"
                );
                return;
            }

            const recommender = await db.getRecommenderByPlatform(
                // id: message.userId,
                message.content.source ?? "unknown",
                user.id
            );

            const filteredPositions = positions.filter(
                (pos) =>
                    pos.recommenderId === recommender?.id &&
                    pos.isSimulation === true
            );

            if (filteredPositions.length === 0 && callback) {
                const responseMemory: Memory = {
                    content: {
                        text: "No simulated positions found.",
                        inReplyTo: message.metadata?.msgId
                            ? message.metadata.msgId
                            : undefined,
                    },
                    userId: message.userId,
                    agentId: message.agentId,
                    roomId: message.roomId,
                    metadata: {
                        ...message.metadata,
                        action: "TRUST_GET_SIMULATED_POSITIONS",
                    },
                    createdAt: Date.now() * 1000,
                };
                await callback(responseMemory);
                return;
            }

            const transactions =
                filteredPositions.length > 0
                    ? await db.getPositionsTransactions(
                          filteredPositions.map((p) => p.id)
                      )
                    : [];

            const tokens: TokenPerformance[] = [];

            const tokenSet = new Set<string>();
            for (const position of filteredPositions) {
                if (tokenSet.has(`${position.chain}:${position.tokenAddress}`))
                    continue;

                const tokenPerformance = await db.getTokenPerformance(
                    position.chain,
                    position.tokenAddress
                );

                if (tokenPerformance) tokens.push(tokenPerformance);

                tokenSet.add(`${position.chain}:${position.tokenAddress}`);
            }

            const {
                positionReports,
                tokenReports,
                totalCurrentValue,
                totalPnL,
                totalRealizedPnL,
                totalUnrealizedPnL,
                positionsWithBalance,
            } = formatFullReport(tokens, filteredPositions, transactions);

            if (callback) {
                const formattedPositions = positionsWithBalance
                    .map(({ position, token, transactions }) => {
                        const latestTx = transactions[transactions.length - 1];
                        const currentValue = token.price
                            ? (
                                  Number(position.balance) * token.price
                              ).toString()
                            : "0";
                        console.log("Calculated current value:", currentValue);
                        const pnlPercent =
                            token.price && position.initialPrice
                                ? (
                                      ((Number(token.price) -
                                          Number(position.initialPrice)) /
                                          Number(position.initialPrice)) *
                                      100
                                  ).toFixed(2)
                                : "0";

                        return (
                            `**${token.symbol} (${token.name})**\n` +
                            `Address: ${token.address}\n` +
                            `Price: $${token.price}\n` +
                            `Value: $${currentValue}\n` +
                            `P&L: ${pnlPercent}%\n`
                        );
                    })
                    .join("\n\n");

                const summary =
                    `💰 **Simulated Portfolio Summary**\n` +
                    `Total Value: ${totalCurrentValue}\n` +
                    `Total P&L: ${totalPnL}\n` +
                    `Realized: ${totalRealizedPnL}\n` +
                    `Unrealized: ${totalUnrealizedPnL}`;

                const responseMemory: Memory = {
                    content: {
                        text:
                            positionsWithBalance.length > 0
                                ? `${summary}\n\n${formattedPositions}`
                                : "No simulated positions found.",
                        inReplyTo: message.metadata?.msgId
                            ? message.metadata.msgId
                            : undefined,
                    },
                    userId: message.userId,
                    agentId: message.agentId,
                    roomId: message.roomId,
                    metadata: {
                        ...message.metadata,
                        action: "TRUST_GET_SIMULATED_POSITIONS",
                    },
                    createdAt: Date.now() * 1000,
                };
                await callback(responseMemory);
            }
        } catch (error) {
            console.error("Error in getPositions:", error);
            throw error;
        }
    },

    async validate(runtime: IAgentRuntime, message: Memory) {
        if (message.agentId === message.userId) return false;
        return true;
    },
};
