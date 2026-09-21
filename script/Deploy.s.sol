// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {EscrowLensEscrow} from "../contracts/EscrowLensEscrow.sol";

/// @notice Deploys EscrowLensEscrow with the arbiter from env.
///         Run (after funding the deployer on Monad testnet 10143):
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url $MONAD_RPC_URL --broadcast --legacy
contract Deploy is Script {
    function run() external returns (EscrowLensEscrow escrow) {
        address arbiter = vm.envAddress("ARBITER_ADDRESS");
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(pk);
        escrow = new EscrowLensEscrow(arbiter);
        vm.stopBroadcast();

        console2.log("EscrowLensEscrow deployed:", address(escrow));
        console2.log("Arbiter:", arbiter);
        console2.log("Chain ID:", block.chainid);
        console2.log("Block:", block.number);
    }
}
