  import {
    elizaLogger,
} from "@elizaos/core";

import {
  ContractOptions,
    createThirdwebClient,
    eth_blockNumber,
    eth_getBlockByNumber,
    getContract,
    getContractEvents,
    GetContractEventsResult,
    getRpcClient,
    PreparedEvent,
    readContract,
    ThirdwebClient,
    watchContractEvents,
  } from "thirdweb";

  import { ethers6Adapter } from "thirdweb/adapters/ethers6";
import { lamina1V5 } from "./chain/lamina1";
import { technomancerAbi } from "./chain/Technomancer";
import { laminateLocationAbi } from "./chain/LaminateLocation";
import { SupabaseProvider } from "./providers/supabase.provider";
import { TechCombinationDescription, TechCombinationName, TechLocation, TechLocationDescription, TechLocationHistory, TechLocationPresent, TechLocationTransfer, TechMetadata, TechSigil, TechTechnomancer, TechTechnomancerHistory, TechTechnomancerTransfer, TechType, TechWisdom } from "./internal-types";
import { TechnomancerAgentClient } from "./technomancer-agent-client";

//0. Model tokens at location
//1. Firstly setup ownership of tech and locations
//2. record tech and locations with metadata at mint
//3. As names are added update
//4. As descriptions are added update
//5. As tokens are tranferred update
//6. When tokens move locations, update

//For context pull previous state, and new state, for narrative.
//All narratives should incluce what previously happened at room, maybe that is how it should work?

//HOW THE FUCK TO USE THE ACTIONS

export class TechnomancerClient {    
  private ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

    private agentClient: TechnomancerAgentClient;
    private newClient: ThirdwebClient;
    private technoContract;
    private locationContract;
    private supabaseProvider: SupabaseProvider;
    private provider;
    private usermap = new Map<string, number>();

    private unwatchTech: () => void;
    private unwatchLoc: () => void;

    private memoryMaker: (block: number, locationId: number, ownerId: number, whatHappened: string, technomancerId?: number, name?: string) => Promise<string>;

    constructor(
      supabaseProvider: SupabaseProvider,
      secret: string,
      technoAddress: string,
      locationAddress: string,
      memoryMaker: (block: number, locationId: number, ownerId: number, whatHappened: string, technomancerId?: number, name?: string) => Promise<string>
    ) {
        this.memoryMaker = memoryMaker;
        this.supabaseProvider = supabaseProvider;

        this.newClient = createThirdwebClient({
          secretKey: secret
        });

        const client = this.newClient;

        this.provider = ethers6Adapter.provider.toEthers({
            client,
            chain: lamina1V5,
        });

        this.technoContract = getContract({
            client: this.newClient,
            chain: lamina1V5,
            address: technoAddress,
            abi: technomancerAbi,
          });

        this.locationContract = getContract({
            client: this.newClient,
            chain: lamina1V5,
            address: locationAddress,
            abi: laminateLocationAbi,
          });
    }

    //721
    //event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    //Techno
    //event CombinationNamed(uint256 indexed tokenId, bytes3 indexed combination, string name);
    //event CombinationDescribed(uint256 indexed tokenId, bytes3 indexed combination);
    //event TokenMoved(uint256 indexed tokenId, bytes3 oldLocation, bytes3 newLocation);

    //Location
    //event LocationNamed(uint256 indexed tokenId, bytes1 indexed locationIndex, string name);
    //event LocationDescribed(uint256 indexed tokenId, bytes1 indexed locationIndex);

    async initialise() {
        let lastRecordedIndex = await this.supabaseProvider.fetchLastBlock();

        if (lastRecordedIndex < 5618229) {
            lastRecordedIndex = await this.supabaseProvider.updateLastBlock(5618229);
        }

        const rpcRequest = getRpcClient(this.technoContract);

        const latestBlockNow = new Number(
            await eth_blockNumber(rpcRequest),
          ).valueOf();

          let current = lastRecordedIndex;
          let step = 2000;
          let errorCount = 0;
      
          while (current < latestBlockNow) {
            let to =
                current + step <= latestBlockNow ? current + step : latestBlockNow;

            const tEvents = await getContractEvents({
                contract: this.technoContract,
                fromBlock: BigInt(current),
                toBlock: BigInt(to),
            });

            const lEvents = await getContractEvents({
                contract: this.locationContract,
                fromBlock: BigInt(current),
                toBlock: BigInt(to),
            });

            let i = 0, j = 0;
            while (i < tEvents.length || j < lEvents.length) {
              let event;
              if (j >= lEvents.length || (i < tEvents.length && tEvents[i].blockNumber <= lEvents[j].blockNumber)) {
                event = tEvents[i];
                ++i;
              }
              else {
                event = lEvents[j];
                ++j;
              }

              const type = event.eventName;

              const tx = event.transactionHash;
              const block = new Number(event.blockNumber).valueOf();
              
              const blockObj = await eth_getBlockByNumber(rpcRequest, {
                blockNumber: BigInt(block),
                includeTransactions: false,
              });

              const ts = this.blockTimestamp(blockObj.timestamp);

              elizaLogger.info(`Got a ${type} event at block ${block}`);

              switch(type) {
                case "Transfer": {
                  //event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
                  const isTech  = event.address.toLowerCase() === this.technoContract.address.toLowerCase();
                  const from = event.args["from"];
                  const to = event.args["to"];
                  const tid = event.args["tokenId"];

                  elizaLogger.info(`${isTech? 'Technomancer' : 'Location'} ${tid} ${from === this.ADDRESS_ZERO ? ' Minted' : ' Transferred'} to ${to} at block ${block} `);

                  //from === 0x0 means mint, we should store the token, minter and metadata at this point
                  const toUser = await this.getUserIdForAddress(to);

                  if(from === this.ADDRESS_ZERO) {
                    isTech ? await this.handleTechMint(tid,toUser,block,ts) : await this.handleLocMint(tid,toUser,block,ts);
                  }
                  else {
                    const fromUser = await this.getUserIdForAddress(from);
                    isTech ? await this.handleTechTransfer(tid,fromUser,toUser, block, ts) : await this.handleLocTransfer(tid,fromUser,toUser,block,ts);
                  }

                  break;
                }
                case "CombinationNamed": {
                  //event CombinationNamed(uint256 indexed tokenId, bytes3 indexed combination, string name);
                  
                  const tokenId = event.args["tokenId"];
                  const combination = event.args["combination"];
                  const name = event.args["name"];

                  await this.handleCombinationNamed(tokenId, combination, name, block, ts);

                  break;
                }
                case "CombinationDescribed": {
                  //event CombinationDescribed(uint256 indexed tokenId, bytes3 indexed combination);
                  //add a new table, so that we cna link tokenId to combination and descriptions so that when we move
                  //we can pick this up.

                  const tokenId = event.args["tokenId"];
                  const combination = event.args["combination"];

                  await this.handleCombinationDescribed(tokenId, combination, block, ts);

                  break;
                }
                case "TokenMoved": {
                  //event TokenMoved(uint256 indexed tokenId, bytes3 oldLocation, bytes3 newLocation);

                  break;
                }
                case "LocationNamed": {
                  //event LocationNamed(uint256 indexed tokenId, bytes1 indexed locationIndex, string name);
                  const ltid = event.args["tokenId"];
                  const lname = event.args["name"];

                  await this.nameLocation(ltid, lname, block, ts);

                  break;
                }
                case "LocationDescribed": {
                  //event LocationDescribed(uint256 indexed tokenId, bytes1 indexed locationIndex);
                  //will need to fetch the descriptions from the chain
                  const ltdid = event.args["tokenId"];
                  await this.describeLocation(ltdid, block, ts);
                  break;
                }
                default:
                  elizaLogger.info(`Not processing events of type ${type}`);
                  break;
              }
            }

            if (errorCount === 0) {
                elizaLogger.info(
                  `No errors encountered, updating last successfully read block`,
                );
                await this.supabaseProvider.updateLastBlock(to + 1);
              }
        
              current = to + 1;
          }
    }

    listen() {
      const rpcRequest = getRpcClient(this.technoContract);

      this.unwatchTech = watchContractEvents({
        contract: this.technoContract,
        onEvents: async (events) => {
          let latestBlock = await this.supabaseProvider.fetchLastBlock();

          for (let i = 0; i < events.length; ++i) {
            const event = events[i];
  
            const type = event.eventName;
  
            const tx = event.transactionHash;
            const block = new Number(event.blockNumber).valueOf();
            const blockObj = await eth_getBlockByNumber(rpcRequest, {
              blockNumber: BigInt(block),
              includeTransactions: false,
            });
            const ts = this.blockTimestamp(blockObj.timestamp);

            //process the event
            switch(type) {
              case "Transfer": {
                const from = (event.args as Record<string, unknown>)[
                  "from"
                ] as  `0x${string}`;
                const to = (event.args as Record<string, unknown>)[
                  "to"
                ] as  `0x${string}`;
                const tid = (event.args as Record<string, unknown>)[
                  "tokenId"
                ] as bigint;

                elizaLogger.info(`'Technomancer' ${tid} ${from === this.ADDRESS_ZERO ? ' Minted' : ' Transferred'} to ${to} at block ${block} `);

                //from === 0x0 means mint, we should store the token, minter and metadata at this point
                const toUser = await this.getUserIdForAddress(to);

                if(from === this.ADDRESS_ZERO) {
                  await this.handleTechMint(tid,toUser,block,ts);
                }
                else {
                  const fromUser = await this.getUserIdForAddress(from);
                  await this.handleTechTransfer(tid,fromUser,toUser, block, ts);
                }
                break;
              }
              case "CombinationNamed": {
                const tid = (event.args as Record<string, unknown>)[
                  "tokenId"
                ] as bigint;
                const combination = (event.args as Record<string, unknown>)[
                  "combination"
                ] as  `0x${string}`;
                const name = (event.args as Record<string, unknown>)[
                  "name"
                ] as  string;

                await this.handleCombinationNamed(tid, combination, name, block, ts);

                break;
              }
              case "CombinationDescribed": {
                const tid = (event.args as Record<string, unknown>)[
                  "tokenId"
                ] as bigint;
                const combination = (event.args as Record<string, unknown>)[
                  "combination"
                ] as  `0x${string}`;

                await this.handleCombinationDescribed(tid, combination, block, ts);

                break;
              }
              default:
                elizaLogger.info(`Not processing technomancer events of type ${type}`);
                break;
            }
          }
        }
      });

      this.unwatchLoc = watchContractEvents({
        contract: this.locationContract,
        onEvents: async (events) => {
          let latestBlock = await this.supabaseProvider.fetchLastBlock();

          for (let i = 0; i < events.length; ++i) {
            const event = events[i];
  
            const type = event.eventName;
  
            const tx = event.transactionHash;
            const block = new Number(event.blockNumber).valueOf();

            //process the event
            const blockObj = await eth_getBlockByNumber(rpcRequest, {
              blockNumber: BigInt(block),
              includeTransactions: false,
            });
            const ts = this.blockTimestamp(blockObj.timestamp);

            //process the event
            switch(type) {
              case "Transfer": {
                const from = (event.args as Record<string, unknown>)[
                  "from"
                ] as  `0x${string}`;
                const to = (event.args as Record<string, unknown>)[
                  "to"
                ] as  `0x${string}`;
                const tid = (event.args as Record<string, unknown>)[
                  "tokenId"
                ] as bigint;

                elizaLogger.info(`'Location' ${tid} ${from === this.ADDRESS_ZERO ? ' Minted' : ' Transferred'} to ${to} at block ${block} `);

                //from === 0x0 means mint, we should store the token, minter and metadata at this point
                const toUser = await this.getUserIdForAddress(to);

                if(from === this.ADDRESS_ZERO) {
                  await this.handleLocMint(tid,toUser,block,ts);
                }
                else {
                  const fromUser = await this.getUserIdForAddress(from);
                  await this.handleLocTransfer(tid,fromUser,toUser, block, ts);
                }
                break;
              }
              case "LocationNamed": {
                //event LocationNamed(uint256 indexed tokenId, bytes1 indexed locationIndex, string name);
                const tid = (event.args as Record<string, unknown>)[
                  "tokenId"
                ] as bigint;
                const name = (event.args as Record<string, unknown>)[
                  "name"
                ] as string;

                await this.nameLocation(tid, name, block, ts);

                break;
              }
              case "LocationDescribed": {
                //event LocationDescribed(uint256 indexed tokenId, bytes1 indexed locationIndex);
                //will need to fetch the descriptions from the chain
                const tid = (event.args as Record<string, unknown>)[
                  "tokenId"
                ] as bigint;

                await this.describeLocation(tid, block, ts);
                break;
              }
              default:
                elizaLogger.info(`Not processing Location events of type ${type}`);
                break;
            }

            latestBlock = block > latestBlock ? block : latestBlock;
            console.log(`${event.transactionHash} - ${event.eventName} - `);
          }

          await this.supabaseProvider.updateLastBlock(latestBlock);
        }
      });

    }

    stop() {
      elizaLogger.info(`Shut down Tech Listener`);
      this.unwatchLoc();
      this.unwatchTech();
      elizaLogger.info(`Tech Listener Shut Down`);
    }    

    private async getUserIdForAddress(
      from: string,
    ) {
      let user_id = this.usermap.get(from);
      if (!user_id) {
        const user = await this.supabaseProvider.fetchOrCreateUser(from);
        this.usermap.set(from, user.id);
        user_id = user.id;
      }
      return user_id;
    }

    private async handleTechMint(tokenId: bigint,  owner: number, block: number, ts: Date) {
      try {
        const decoded = await this.fetchMetadataForToken(tokenId);

        const { character, location, sigil, wisdom } = await readContract({contract: this.technoContract, method: "getMetadata", params:[tokenId]});

        elizaLogger.info(`Minted token ${tokenId} has character ${character} at location ${location} with Sigil ${sigil} and maybe Wisdom ${wisdom}`);

        //this is a mint
        //0. If ID > 15 need to find parent of same type
        let parent: TechTechnomancer;
        const techType: TechType = await this.supabaseProvider.findTypeByCode(this.charCodeToString(character));

        //1. Create the technomancer record
        const techLoc: TechLocation = await this.supabaseProvider.findLocationIdByCode(this.charCodeToString(location));
        const techSigil: TechSigil = await this.supabaseProvider.findSigilByCode(this.charCodeToString(sigil));
        
        const tech : TechTechnomancer = {
          tokenid: Number(tokenId), 
          locationid: techLoc.id,
          typeid: techType.id,
          sigilid: techSigil.id,
          mintedby: owner,
          owner: owner,
          image: decoded.image
        } as TechTechnomancer;

        if(tokenId > 15/** Lazy, OT limit */) {
          parent = await this.supabaseProvider.findTechnoParentByType(techType.id);
          if(parent) {
            tech.parentid = parent.id;
          }
        }

        let techWisdom: TechWisdom;
        if(wisdom && wisdom !== this.ADDRESS_ZERO) {
          techWisdom = await this.supabaseProvider.findWisdomByCode(this.charCodeToString(wisdom));
          if(techWisdom) {
            tech.wisdomid = techWisdom.id;
          }
        }

        const insertedId = await this.supabaseProvider.insertTechnomancer(tech);
        elizaLogger.info(`Inserted new Technomancer token with the ID ${insertedId}`);

        //2. Create the technomancer history record
        const th = {
          technomancerid: insertedId,
          locationid: techLoc.id,
          sigilid: techSigil.id,
          owner:owner, 
          block: block, 
          blocktimestamp: ts
        } as TechTechnomancerHistory;

        if(techWisdom) {
          th.wisdomid = techWisdom.id;
        }

        await this.supabaseProvider.addTechnomancerHistory(th);

        //3. Add the transfer to the transfer table
        const tt =  {
          technomancerid: insertedId,
          to: owner,
          block: block,
          blocktimestamp: ts
        } as TechTechnomancerTransfer;

        await this.supabaseProvider.addTechnomancerTransfer(tt);

        //4. Add the technomancer to the location in the present field
        const tl = await this.supabaseProvider.fetchLocation(techLoc.id);

        tl.present = tl.present || new TechLocationPresent();
        tl.present.ids = tl.present.ids || [];
        if(!tl.present.ids.includes(insertedId)) {
          tl.present.ids.push(insertedId);
          tl.present.block = block;
          tl.present.blocktimestamp = ts;
          await this.supabaseProvider.updatePresent(tl);

          //and also have to update location history, if the location exists
          if(tl.owner) {
            const lh = {
              locationid: techLoc.id,
              name: tl.name,
              description: tl.description,
              owner: tl.owner,
              block: block,
              blocktimestamp: ts,
              present: tl.present
            } as TechLocationHistory;
            await this.supabaseProvider.addLocationHistory(lh);
          }
        }

        //awesome minted, callback, get some story going
        let whatHappened = `A new Technomancer is born, a ${techType.name}, at the ${techLoc.name} and this one with a ${techSigil.name}.`;
        if(techWisdom) {
          whatHappened = `${whatHappened} This OT ${techType.name} is filled with the spirit of ${techWisdom.name}`;
        }
        else{
          whatHappened = `${whatHappened} This Technomancer is a projection of the OT ${techType.name}`;
          if(parent?.name) {
            whatHappened = `${whatHappened} who is called ${parent.name}`;
          }
        }

        await this.memoryMaker(block, techLoc.id, owner, whatHappened, insertedId);
      }
      catch (error) {
        elizaLogger.error(`Now we're out of sorts, from block ${block} because ${error}`);
      }
    }

    private async handleTechTransfer(tokenId: bigint, from: number, to: number, block: number, ts: Date) {
      try {
        const techno = await this.supabaseProvider.transferTechnomnacerTo(tokenId, from, to, block, ts);

        const th = {
          technomancerid: techno.id,
          locationid: techno.locationid,
          sigilid: techno.sigilid,
          name: techno.name,
          description: techno.description,
          owner: to, 
          block: block, 
          blocktimestamp: ts
        } as TechTechnomancerHistory;

        if(techno.wisdomid > -1) {
          th.wisdomid = techno.wisdomid;
        }

        await this.supabaseProvider.addTechnomancerHistory(th);

        //3. Add the transfer to the transfer table
        const tt =  {
          technomancerid: techno.id,
          from: from,
          to: to,
          block: block,
          blocktimestamp: ts
        } as TechTechnomancerTransfer;

        await this.supabaseProvider.addTechnomancerTransfer(tt);
      }
      catch(error) {
        elizaLogger.error(`Error transferring Technomancer ${tokenId} from ${from} to ${to}`);
      }
    }

    private async handleLocMint(tokenId: bigint,  owner: number, block: number, ts: Date) {
      try {
        const locations = await readContract({contract: this.locationContract, method: "locations", params:[]});

        //get the index of this locationId
        const locIndex = locations[0][Number(tokenId)];

        //Find the location
        const locIndexStr = this.charCodeToString(locIndex);
        const tl : TechLocation = await this.supabaseProvider.findLocationIdByCode(locIndexStr);

        //Add the owner, guard it so that if owner already set, it's OK
        if(!tl.owner) {
          await this.supabaseProvider.addOwnerToLocation(tl.id, Number(tokenId), owner, owner);

          //Add location history
          const lh = {
            locationid: tl.id,
            name: tl.name,
            present: tl.present,
            owner: owner, 
            block: block, 
            blocktimestamp: ts
          } as TechLocationHistory;

          await this.supabaseProvider.addLocationHistory(lh);
          
          //Add location transfer
          const lt =  {
            locationid: tl.id,
            to: owner,
            block: block,
            blocktimestamp: ts
          } as TechLocationTransfer;

          await this.supabaseProvider.addLocationTransfer(lt);
        }
      }
      catch(error) {
        elizaLogger.error(`Now we're out of sorts on Locations, from block ${block} because ${error}`);
      }
    }

    private async handleLocTransfer(tokenId: bigint, from: number, to: number, block: number, ts: Date) {
      try {
        const location = await this.supabaseProvider.transferLocationTo(tokenId, from, to, block, ts);

        const lh = {
          locationid: location.id,
          name: location.name,
          description: location.description,
          present: location.present,
          owner: location.owner, 
          block: block, 
          blocktimestamp: ts
        } as TechLocationHistory;

        await this.supabaseProvider.addLocationHistory(lh);

        //3. Add the transfer to the transfer table
        const lt =  {
          locationid: location.id,
          from: from,
          to: to,
          block: block,
          blocktimestamp: ts
        } as TechLocationTransfer;

        await this.supabaseProvider.addLocationTransfer(lt);
      }
      catch(error) {
        elizaLogger.error(`Error transferring Location ${tokenId} from ${from} to ${to}`);
      }
    }
    
    private async nameLocation(tokenId: bigint, name: string, block: number, ts: Date) {
      try {
        const location = await this.supabaseProvider.updateLocationName(tokenId, name);

        const lh = {
          locationid: location.id,
          name: location.name,
          description: location.description,
          present: location.present,
          owner: location.owner, 
          block: block, 
          blocktimestamp: ts
        } as TechLocationHistory;

        await this.supabaseProvider.addLocationHistory(lh);

        let whatHappened = `This Location has been renamed ${location.name}`;
        await this.memoryMaker(block, location.id, location.owner, whatHappened);
      }
      catch(error) {
        elizaLogger.error(`Error naming Location ${tokenId} to ${name}`);
      }
    }

    async describeLocation(tokenId: bigint, block: number, ts: Date) {
      try {
        //function descriptions(uint256 tokenId) public view returns (string[] memory) {}
        const descriptions = await readContract({contract: this.locationContract, method: "descriptions", params:[tokenId]});

        let location = await this.supabaseProvider.fetchLocationByTokenId(Number(tokenId));      
        const existingDescriptions : TechLocationDescription[] = await this.supabaseProvider.fetchDescriptionsForLocationTokenId(tokenId);

        //ok this is clunky as hell, I regret my event lack of indexing!
        const iterate = descriptions.length >= existingDescriptions.length ? existingDescriptions.length : descriptions.length;

        for (var i = 0; i < iterate; i++) {
          if(existingDescriptions[i].description !== descriptions[i]) {
            //deactivate at index, insert new active record at index
            await this.supabaseProvider.deactivateLocationDescription(existingDescriptions[i].id);

            const ld = {
              locationid: existingDescriptions[i].locationid,
              previous: existingDescriptions[i].id,
              descindex: i,
              description: descriptions[i],
              active: true,
            } as TechLocationDescription;

            await this.supabaseProvider.insertLocationDescription(ld);
          }
        }

        //if there are more existing than on chain, delete
        if(existingDescriptions.length > descriptions.length) {
          for (var i = descriptions.length; i < existingDescriptions.length; ++i) {
            await this.supabaseProvider.deactivateLocationDescription(existingDescriptions[i].id);
          }
        }
        //if there are more on chain, than existing, add
        else if(descriptions.length > existingDescriptions.length) {
          for (var i = existingDescriptions.length; i < descriptions.length; ++i) {
            const ld = {
              locationid: location.id,
              descindex: i,
              description: descriptions[i],
              active: true,
            } as TechLocationDescription;

            await this.supabaseProvider.insertLocationDescription(ld);
          }
        }
        
        //update the big description string
        const bigString = descriptions.join(`\n\n`);

        //update the record
        location = await this.supabaseProvider.updateLocationDescription(tokenId, bigString);

        const lh = {
          locationid: location.id,
          name: location.name,
          description: location.description,
          present: location.present,
          owner: location.owner, 
          block: block, 
          blocktimestamp: ts
        } as TechLocationHistory;

        //update history
        await this.supabaseProvider.addLocationHistory(lh);

        let whatHappened = `This Location - ${location.name} has been described as ${location.description}`;
        await this.memoryMaker(block, location.id, location.owner, whatHappened);
      }
      catch(error) {
        elizaLogger.error(`Error describing Location ${tokenId}`);
      }
    }

    async handleCombinationNamed(tokenId: bigint, combination: `0x${string}`, name: string, block: number, ts: Date) {
      try {
        //if name already exists deactivate
        const techno = await this.supabaseProvider.fetchTechnomancer(tokenId);

        const combinationa = this.charCodeToString(`0x${combination.substring(2,4)}`);
        const combinationb = this.charCodeToString(`0x${combination.substring(4,6)}`);
        const combinationc = this.charCodeToString(`0x${combination.substring(6,8)}`);
        const combinationString = `${combinationa}${combinationb}${combinationc}`;

        const existingName: TechCombinationName = await this.supabaseProvider.fetchCombinationName(combinationString);

        if(existingName) {
          await this.supabaseProvider.deactivateCombinationName(existingName.id);
        }

        //add new name
        const cn = {
          namedby: techno.owner,
          combination: combinationString,
          name: name,
          active: true,
        } as TechCombinationName;

        if(existingName) {
          cn.previous = existingName.id;
        }

        await this.supabaseProvider.addCombinationName(cn);

        //update token
        await this.supabaseProvider.updateTechnomancerName(tokenId, name);

        //update history
        const th = {
          technomancerid: techno.id,
          locationid: techno.locationid,
          sigilid: techno.sigilid,
          name: name,
          description: techno.description,
          owner: techno.owner, 
          block: block, 
          blocktimestamp: ts
        } as TechTechnomancerHistory;

        let parent: TechTechnomancer;
        if(techno.wisdomid > -1) {
          th.wisdomid = techno.wisdomid;
        }
        else {
          parent = await this.supabaseProvider.findTechnoParentByType(techno.typeid);
        }

        await this.supabaseProvider.addTechnomancerHistory(th);

        //awesome minted, callback, get some story going
        let whatHappened = `Technomancer has a new name, `;
        if(existingName){
          whatHappened = `${whatHappened} they were ${existingName.name}, they are now ${name}.`;
        }
        else {
          whatHappened = `${whatHappened} whoever they were before, they are now ${name}.`
        }

        if(techno.wisdomid > -1) {
          whatHappened = `${whatHappened} This name shall be shared amongst all their Projections.`;
        }
        else {
          if(parent?.name) {
            whatHappened = `${whatHappened} Their OT is named ${parent.name} and so they are now ${parent.name}-${name}.`
          }
        }

        await this.memoryMaker(block, techno.locationid, techno.owner, whatHappened, techno.id, name);

      }
      catch(error) {
        elizaLogger.error(`Error naming technomancer ${tokenId}`);
      }      
    }

    async handleCombinationDescribed(tokenId: bigint, combination: `0x${string}`, block: number, ts: Date) {
      try {
        //if name already exists deactivate
        const techno = await this.supabaseProvider.fetchTechnomancer(tokenId);

        const combinationa = this.charCodeToString(`0x${combination.substring(2,4)}`);
        const combinationb = this.charCodeToString(`0x${combination.substring(4,6)}`);
        const combinationc = this.charCodeToString(`0x${combination.substring(6,8)}`);
        const combinationString = `${combinationa}${combinationb}${combinationc}`;

        const existingDescription: TechCombinationDescription = await this.supabaseProvider.fetchCombinationDescription(combinationString);

        const metadata = await this.fetchMetadataForToken(tokenId);
        const description = metadata.description;

        if(existingDescription) {
          await this.supabaseProvider.deactivateCombinationDescription(existingDescription.id);
        }

        //add new name
        const cd = {
          describedby: techno.owner,
          combination: combinationString,
          description: description,
          active: true,
        } as TechCombinationDescription;

        if(existingDescription) {
          cd.previous = existingDescription.id;
        }

        await this.supabaseProvider.addCombinationDescription(cd);

        //update token
        await this.supabaseProvider.updateTechnomancerDescription(tokenId, description);

        //update history
        const th = {
          technomancerid: techno.id,
          locationid: techno.locationid,
          sigilid: techno.sigilid,
          name: techno.name,
          description: description,
          owner: techno.owner, 
          block: block, 
          blocktimestamp: ts
        } as TechTechnomancerHistory;

        if(techno.wisdomid > -1) {
          th.wisdomid = techno.wisdomid;
        }

        await this.supabaseProvider.addTechnomancerHistory(th);

      }
      catch(error) {
        elizaLogger.error(`Error naming technomancer ${tokenId}`);
      }      
    }

    private async fetchMetadataForToken(tokenId: bigint): Promise<TechMetadata> {
      const encodedURI = await readContract({ contract: this.technoContract, method: "tokenURI", params: [tokenId] });
      const raw = encodedURI.replace(
        /^data:application\/json;base64,/,
        ""
      );
  
      const decoded = JSON.parse(
        Buffer.from(raw, "base64").toString("utf8")
      );
      return decoded as TechMetadata;
    }

    private charCodeToString(index: `0x${string}`) : string {
      return String.fromCharCode(+index);
    }

    private blockTimestamp(ts : bigint) : Date {
      const tsstr = new Date(Number(ts) * 1000);

      return tsstr;
    }
}
