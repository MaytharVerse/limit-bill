import {
    BigInt,
    BytesData,
    ethereum,
    hexToUint8Array,
    IAspectOperation,
    IPostContractCallJP,
    JitCallBuilder,
    StaticCallRequest,
    OperationInput,
    PostContractCallInput,
    stringToUint8Array,
    sys,
    uint8ArrayToHex,
    uint8ArrayToString,
} from "@artela/aspect-libs";
import { Protobuf } from "as-proto/assembly/Protobuf";

/**
 * There are two types of Aspect: Transaction-Level Aspect and Block-Level Aspect.
 * Transaction-Level Aspect will be triggered whenever there is a transaction calling the bound smart contract.
 * Block-Level Aspect will be triggered whenever there is a new block generated.
 *
 * An Aspect can be Transaction-Level, Block-Level,IAspectOperation or both.
 * You can implement corresponding interfaces: IAspectTransaction, IAspectBlock,IAspectOperation or both to tell Artela which
 * type of Aspect you are implementing.
 */
export class Aspect implements IPostContractCallJP, IAspectOperation {

    static readonly SYS_PLAYER_STORAGE_KEY: string = 'SYS_PLAYER_STORAGE_KEY';
    static readonly SYS_LMT_BILL_STORAGE_KEY: string = 'SYS_LMT_BILL_STORAGE_KEY';
    static readonly POOL_ADDRESS: string = '0xe40897Ec3d45486EFd5E2722a40f50C20628eeda';
    postContractCall(input: PostContractCallInput): void {

        let ret = this.getQuote(BigInt.fromString('0x016345785d8a0000', 16).toUInt64(),0,true);
        ret = '0x00000000000000000000000000000000000000000000001af42db18bc885969e0000000000000000000000000000000000000046597d721e21a8bcc997d4afca0000000000000000000000000000000000000000000000000000000000014c51';
        ret = this.rmPrefix(ret);
        let price_string = ret.substr(64,128);
        
        let quote_price = BigInt.fromString(price_string, 16).toUInt64();
        sys.log('adamayu quote price:' + quote_price.toString() );
        //get price limited
        let billKey = sys.aspect.mutableState.get<Uint8Array>(Aspect.SYS_LMT_BILL_STORAGE_KEY);
        let encodeBills = uint8ArrayToHex(billKey.unwrap());
        const array = new Array<string>();
        if (encodeBills != "") {
            let encodeCount = encodeBills.slice(0, 4);
            encodeBills =encodeBills.slice(4,encodeBills.length);
            let count = BigInt.fromString(encodeCount, 16).toInt32();
            for (let i = 0; i < count; ++i) {
                array[i] = encodeBills.slice(106 * i, 106 * (i + 1)).toLowerCase();
                let limit_string = array[i].slice(64,104);
                let buyorsell_string = array[i].slice(104,106);
                let limit_price = BigInt.fromString(limit_string, 16).toUInt64();

                sys.log('adamayu limit price:' + limit_price.toString() );
                if(quote_price < limit_price && buyorsell_string == '01') {
                    //buy swap
                    sys.log('adamayu buy' );
                    //remove bill i+1
                    this.removeLmtBill((i+1).toString(16).padStart(4, '0'));
                    break;
                }

                if(quote_price > limit_price && buyorsell_string == '00') {
                    //sell swap
                    sys.log('adamayu sell' );
                    //remove bill i+1
                    this.removeLmtBill((i+1).toString(16).padStart(4, '0'));
                    break;
                }

            }
            encodeCount = this.rmPrefix(count.toString(16)).padStart(4, '0');

            encodeBills = encodeCount + encodeBills.slice(4, encodeBills.length) + bill;
        }


        // let calldata = uint8ArrayToHex(input.call!.data);
        // let method = this.parseCallMethod(calldata);

        // // if method is 'move(uint64,uint8)'
        // if (method == "0x72d7d60c") {
        //     let currentCaller = uint8ArrayToHex(input.call!.from);
        //     let sysPlayers = this.getSysPlayersList();
        //     let isSysPlayer = sysPlayers.includes(this.rmPrefix(currentCaller).toLowerCase());

        //     // if player moves, sys players also move just-in-time
        //     if (!isSysPlayer) {
        //         const roomId = this.extractRoomId(input.call!.data);
        //         const sysPlayer = this.getSysPlayerAccount(roomId)
        //         if (sysPlayer == "") {
        //             // no free sys player, do nothing
        //             return;
        //         }

        //         // do jit-call
        //         this.doMove(sysPlayer, roomId, input);
        //     } else {
        //         // if sys player moves, do nothing in Aspect and pass the join point
        //         return;
        //     }
        // }

    }

   

    operation(input: OperationInput): Uint8Array {
        // calldata encode rule
        // * 2 bytes: op code
        //      op codes lists:
        //           0x0001 | registerSysPlayer
        //
        //           ** 0x10xx means read only op **
        //           0x1001 | getSysPlayers
        //           0x1002 | getAAWaletNonce
        //
        // * variable-length bytes: params
        //      encode rule of params is defined by each method
        const calldata = uint8ArrayToHex(input.callData);
        const op = this.parseOP(calldata);
        const params = this.parsePrams(calldata);

        if (op == "0001") {
            sys.log('adamayu in 0001');
            this.registerSysPlayer(params);
            return new Uint8Array(0);
        }
        if(op == "0002") {
            sys.log('adamayu in 0002');
            this.addLmtBill(params);
            return new Uint8Array(0);
        }
        if(op == "0003") {
            // sys.log('adamayu in 0003 removeLmtBill');
            // sys.log('adamayu in 0003 params' + params);
            this.removeLmtBill(params);
            return new Uint8Array(0);
        }
        if (op == "1001") {
            let ret = this.getSysPlayers();
            return stringToUint8Array(ret);
        }
        if (op == "1002") {
            let ret = this.getLmtBills();
            return stringToUint8Array(ret);
        }
        if (op == "1003") {
            sys.log('adamayu in 1003');
            let ret = this.getQuote(BigInt.fromString('0x016345785d8a0000', 16).toUInt64(),0,true);
            return stringToUint8Array(ret);
        }
        if (op == "1004") {
            sys.log('adamayu in 1004');
            return stringToUint8Array(this.getBalanceOf());
        }

        // if (op == "1002") {
        //     let ret = this.getSysPlayerInRoom(BigInt.fromString(params, 16).toUInt64());
        //     return stringToUint8Array(ret);
        // }
        

        sys.revert("unknown op");
        return new Uint8Array(0);
    }
    
    addLmtBill(params: string):void {
        sys.log('in addLmtBill');
        sys.require(params.length == 106, "illegal params");
        sys.log('in addLmtBill 1');
        const bill = params.slice(0, 106);
        let billKey = sys.aspect.mutableState.get<Uint8Array>(Aspect.SYS_LMT_BILL_STORAGE_KEY);
        let encodeBills = uint8ArrayToHex(billKey.unwrap());
        if (encodeBills == "") {
            let count = "0001";
            encodeBills = count + bill;
        } else {
            let encodeCount = encodeBills.slice(0, 4);
            let count = BigInt.fromString(encodeCount, 16).toInt32();

            count++;
            encodeCount = this.rmPrefix(count.toString(16)).padStart(4, '0');

            encodeBills = encodeCount + encodeBills.slice(4, encodeBills.length) + bill;
        }
        billKey.set(hexToUint8Array(encodeBills));
    }
    removeLmtBill(params: string):void {
        // sys.log('adamayu in removeLmtBill 1');
        // sys.log('adamayu in params.length '+params.length.toString());
        sys.require(params.length == 4, "illegal params");
        const encodeIndex = params.slice(0, 4);
       
        let index = BigInt.fromString(encodeIndex, 16).toInt32();
        // sys.log('adamayu in removeLmtBill 2 index' + index.toString());
        let billKey = sys.aspect.mutableState.get<Uint8Array>(Aspect.SYS_LMT_BILL_STORAGE_KEY);
        let encodeBills = uint8ArrayToHex(billKey.unwrap());
        // sys.log('adamayu in removeLmtBill encodeBills' + encodeBills);
        sys.require(encodeBills.length >= 110, "no limit bills");
        let encodeCount = encodeBills.slice(0, 4);
        let count = BigInt.fromString(encodeCount, 16).toInt32();
        // sys.log('adamayu in removeLmtBill count' + count.toString());
        sys.require(index > 0 && index <= count, "out of index boundry");
        encodeBills = encodeBills.slice(4,encodeBills.length);
        // sys.log('adamayu in removeLmtBill encodeBills' + encodeBills);
        let billsStart = encodeBills.slice(0,106 * (index-1));
        // sys.log('adamayu in removeLmtBill billsStart' + billsStart);
        let billsEnd = encodeBills.slice(106 * index,encodeBills.length);
        // sys.log('adamayu in removeLmtBill billsEnd' + billsEnd);
        count--;
        if(count > 0 ) {
            encodeCount = this.rmPrefix(count.toString(16)).padStart(4, '0');
            encodeBills = encodeCount + billsStart + billsEnd;
            billKey.set(hexToUint8Array(encodeBills));
        } 
        else {
            billKey.set(hexToUint8Array(''));
        }
    }
    getLmtBills():string {
        return uint8ArrayToHex(sys.aspect.mutableState.get<Uint8Array>(Aspect.SYS_LMT_BILL_STORAGE_KEY).unwrap());
    }
    getQuote(amount: u64,sqrtPriceLimitX96:u64,buyOrSell:boolean):string {
        sys.log('adamayu quote amount' + amount.toString());
        let quoteCalldata = ethereum.abiEncode('quote', [ethereum.Tuple.fromCoders([
            ethereum.Address.fromHexString('0xe40897Ec3d45486EFd5E2722a40f50C20628eeda'),
            ethereum.Number.fromU64(amount,256),
            ethereum.Number.fromU64(sqrtPriceLimitX96,160),
            ethereum.Boolean.fromBoolean(buyOrSell)]),
        ]);
        sys.log('adamayu quote call data:' + quoteCalldata.toString());
        sys.log('adamayu quote from:' + this.getSysPlayersList()[0]);
        sys.log('adamayu quote to:' + '0xE97E4f4bF4E698cA316aab4353Eb6C2AcC0be8AC');
        const from = hexToUint8Array(this.getSysPlayersList()[0]);
        const to = hexToUint8Array('0xE97E4f4bF4E698cA316aab4353Eb6C2AcC0be8AC');

        const request = JitCallBuilder.simple(from, to, hexToUint8Array(quoteCalldata)).build();
        // Submit the JIT call
        const response = sys.hostApi.evmCall.jitCall(request);
        sys.log('adamayu quote response' + uint8ArrayToHex(response.ret));
        sys.log('adamayu quote response error' + response.errorMsg);
        // const staticCallRequest = new StaticCallRequest( from,to,hexToUint8Array(quoteCalldata),100000000000);
        // sys.log('adamayu quote from' + from.toString());
        // sys.log('adamayu quote to' + to.toString());
        // // sys.log('adamayu quote hex call data' +hexToUint8Array(quoteCalldata));
        // const staticCallResult = sys.hostApi.evmCall.staticCall(staticCallRequest);
        sys.log('adamayu in static call');
        // sys.log('adamayu  static call ret '+ uint8ArrayToHex(staticCallResult.ret));
        // sys.log('adamayu  static call error '+ staticCallResult.vmError);
        return  uint8ArrayToHex(response.ret);
    }

    // cast call 0xaDfEcE47796a02245AeE3f65F39318986f946a66 "balanceOf(address)(uint256)" 0xf9f72f7bb3639164e163081bdbe9e4d2c5fc4a7c
    getBalanceOf():string {
        let calldata = ethereum.abiEncode('balanceOf', [
            ethereum.Address.fromHexString('0xf9f72f7bb3639164e163081bdbe9e4d2c5fc4a7c'),
        ]);
        const from = hexToUint8Array(this.getSysPlayersList()[0]);
        const to = hexToUint8Array('0xaDfEcE47796a02245AeE3f65F39318986f946a66');
        // const from = sys.aspect.property.get<Uint8Array>(this.getSysPlayersList()[0]);
        // const to = sys.aspect.property.get<Uint8Array>('aDfEcE47796a02245AeE3f65F39318986f946a66');
        const staticCallRequest = new StaticCallRequest(
            from, to,hexToUint8Array(calldata), 1000000000
            );
        const staticCallResult = sys.hostApi.evmCall.staticCall(staticCallRequest);
        sys.log('adamayu in static call');
        sys.log('adamayu  static call ret '+ uint8ArrayToHex(staticCallResult.ret));
        sys.log('adamayu  static call error '+ staticCallResult.vmError);
        return uint8ArrayToHex(staticCallResult.ret);
    }

   
    parseCallMethod(calldata: string): string {
        if (calldata.startsWith('0x')) {
            return calldata.substring(0, 10);
        }
        return '0x' + calldata.substring(0, 8);
    }

    parseOP(calldata: string): string {
        if (calldata.startsWith('0x')) {
            return calldata.substring(2, 6);
        } else {
            return calldata.substring(0, 4);
        }
    }

    parsePrams(calldata: string): string {
        if (calldata.startsWith('0x')) {
            return calldata.substring(6, calldata.length);
        } else {
            return calldata.substring(4, calldata.length);
        }
    }

    rmPrefix(data: string): string {
        if (data.startsWith('0x')) {
            return data.substring(2, data.length);
        } else {
            return data;
        }
    }

    registerSysPlayer(params: string): void {
        this.saveSysPlayer(params, Aspect.SYS_PLAYER_STORAGE_KEY);
    }

    private saveSysPlayer(params: string, storagePrefix: string): void {
        // params encode rules:
        //     20 bytes: player address
        //         eg. e2f8857467b61f2e4b1a614a0d560cd75c0c076f

        sys.require(params.length == 40, "illegal params");
        const player = params.slice(0, 40);

        let sysPlayersKey = sys.aspect.mutableState.get<Uint8Array>(storagePrefix);
        let encodeSysPlayers = uint8ArrayToHex(sysPlayersKey.unwrap());
        if (encodeSysPlayers == "") {
            let count = "0001";
            encodeSysPlayers = count + player;
        } else {
            let encodeCount = encodeSysPlayers.slice(0, 4);
            let count = BigInt.fromString(encodeCount, 16).toInt32();

            count++;
            encodeCount = this.rmPrefix(count.toString(16)).padStart(4, '0');

            encodeSysPlayers = encodeCount + encodeSysPlayers.slice(4, encodeSysPlayers.length) + player;
        }

        sysPlayersKey.set(hexToUint8Array(encodeSysPlayers));
    }

    getSysPlayers(): string {
        return uint8ArrayToHex(sys.aspect.mutableState.get<Uint8Array>(Aspect.SYS_PLAYER_STORAGE_KEY).unwrap());
    }

    getSysPlayersList(): Array<string> {
        let sysPlayersKey = sys.aspect.mutableState.get<Uint8Array>(Aspect.SYS_PLAYER_STORAGE_KEY);
        let encodeSysPlayers = uint8ArrayToHex(sysPlayersKey.unwrap());

        let encodeCount = encodeSysPlayers.slice(0, 4);
        let count = BigInt.fromString(encodeCount, 16).toInt32();
        const array = new Array<string>();
        encodeSysPlayers = encodeSysPlayers.slice(4);
        for (let i = 0; i < count; ++i) {
            array[i] = encodeSysPlayers.slice(40 * i, 40 * (i + 1)).toLowerCase();
        }

        return array;
    }


    //****************************
    // unused methods
    //****************************

    isOwner(sender: Uint8Array): bool {
        return false;
    }
}