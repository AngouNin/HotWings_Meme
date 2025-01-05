import * as anchor from '@project-serum/anchor';
import {
    Program,
    web3,
} from '@project-serum/anchor';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import assert from 'assert';
import { HotWingsContract } from '../target/types/hotwings_contract';

const { SystemProgram } = web3;

describe('HotWingsMemecoin', () => {
    // Set up the provider using the environment (devnet/localnet/mainnet)
    anchor.setProvider(anchor.AnchorProvider.env());
    
    // Create an instance of the HotWings contract program
    const program = anchor.workspace.HotWingsContract as Program<HotWingsContract>;

    const totalSupply = 1000000; // Set a total supply of tokens for the tests

    let state: anchor.web3.PublicKey; // Public key for the state account of the contract
    let owner: anchor.web3.Keypair; // Owner's keypair that will own the contract
    let burnWallet: anchor.web3.PublicKey; // Public key for the burn wallet
    let marketingWallet: anchor.web3.PublicKey; // Public key for the marketing wallet
    let tokenMint: anchor.web3.PublicKey; // The mint public key for the SPL token
    let ownerTokenAccount: anchor.web3.PublicKey; // The owner's token account to hold tokens

    before(async () => {
        owner = anchor.web3.Keypair.generate(); // Generate a new keypair for the owner
        
        // Airdrop some SOL to the owner for transaction fees
        await anchor.getProvider().connection.requestAirdrop(owner.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

        // Create new token mint associated with the owner
        const mint = await Token.createMint(
            anchor.getProvider().connection,
            owner,
            owner.publicKey,
            null,
            9, // Setting the decimal precision for the token
            TOKEN_PROGRAM_ID,
        );
        tokenMint = mint.publicKey; // Record the public key of the created mint

        // Create the owner's token account to hold the tokens
        ownerTokenAccount = await mint.getOrCreateAssociatedAccountInfo(owner.publicKey);
        
        // Create burn and marketing wallets as new token accounts
        burnWallet = await mint.getOrCreateAssociatedAccountInfo(anchor.web3.Keypair.generate().publicKey);
        marketingWallet = await mint.getOrCreateAssociatedAccountInfo(anchor.web3.Keypair.generate().publicKey);
        
        // Initialize the contract state with the specified total supply
        const tx = await program.methods
            .initialize(totalSupply)
            .accounts({
                state: state, // State account for storing contract info
                owner: owner.publicKey, // Owner's public key
                systemProgram: SystemProgram.programId, // Reference to Solana's system program
            })
            .signers([owner]) // Sign the transaction with the owner's keypair
            .rpc(); // Send the transaction

        console.log("Initialize transaction signature", tx); // Log the transaction signature for debugging
    });

    it('should update market cap', async () => {
        const newMarketCap = 500000; // Define a new market cap value to be set

        // Invoke the updateMarketCap method
        await program.methods
            .updateMarketCap(newMarketCap) // Call the contract method to update market cap
            .accounts({
                state: state, // Pass the state account to allow updates
                owner: owner.publicKey, // Authenticate the action using the owner's public key
            })
            .signers([owner]) // Sign the transaction with the owner's keypair
            .rpc(); // Send the transaction
        
        // Fetch the updated state to verify the market cap was updated
        const updatedState = await program.account.state.fetch(state);
        
        // Assert that the updated market cap matches the expected value
        assert.strictEqual(updatedState.marketCap.toNumber(), newMarketCap, "Market cap should be updated");
    });

    it('should transfer tokens and respect wallet cap and tax rules', async () => {
        const transferAmount = 10000; // Example transfer amount for testing

        // Mint tokens to the owner's token account to initiate the transfer test
        await mint.mintTo(ownerTokenAccount, owner.publicKey, [], transferAmount);

        // Get current balances for comparison after the transfer
        const preTransferOwnerBalance = await mint.getAccountInfo(ownerTokenAccount);
        const preTransferBurnBalance = await mint.getAccountInfo(burnWallet);
        const preTransferMarketingBalance = await mint.getAccountInfo(marketingWallet);
        
        // Perform the token transfer
        await program.methods
            .transfer(transferAmount) // Invoke the transfer method
            .accounts({
                state: state, // Pass in the state account for contract data
                sender: owner.publicKey, // Specify the sender (owner) account
                receiver: ownerTokenAccount, // Specify the receiver account
                burnWallet: burnWallet, // Specify the burn wallet
                marketingWallet: marketingWallet, // Specify the marketing wallet
                tokenProgram: TOKEN_PROGRAM_ID, // Reference to the SPL Token program
            })
            .signers([owner]) // Sign the transaction with the owner's keypair
            .rpc(); // Send the transaction
        
        // Get updated balances after the transfer for verification
        const postTransferOwnerBalance = await mint.getAccountInfo(ownerTokenAccount);
        const postTransferBurnBalance = await mint.getAccountInfo(burnWallet);
        const postTransferMarketingBalance = await mint.getAccountInfo(marketingWallet);

        // Calculate the expected values based on logic within the transfer function
        const expectedTax = Math.floor(transferAmount * 0.015); // Calculate 1.5% tax
        const expectedBurnAndMarketingAmount = Math.floor(expectedTax / 2); // Half for each wallet
        const expectedTransferAmount = transferAmount - expectedTax; // Amount to transfer after tax deduction

        // Validate the owner's balance after the transfer
        assert.strictEqual(
            postTransferOwnerBalance.amount.toNumber(),
            preTransferOwnerBalance.amount.toNumber() + expectedTransferAmount,
            "Owner's token balance should reflect the transfer minus taxes"
        );

        // Validate the burn wallet balance after the transfer
        assert.strictEqual(
            postTransferBurnBalance.amount.toNumber(),
            preTransferBurnBalance.amount.toNumber() + expectedBurnAndMarketingAmount,
            "Burn wallet should have increased by half the tax amount"
        );

        // Validate the marketing wallet balance after the transfer
        assert.strictEqual(
            postTransferMarketingBalance.amount.toNumber(),
            preTransferMarketingBalance.amount.toNumber() + expectedBurnAndMarketingAmount,
            "Marketing wallet should have increased by half the tax amount"
        );
    });

    it('should fail if wallet cap is exceeded', async () => {
        const excessiveAmount = (totalSupply * 5 / 100) + 1; // Exceeding 5% of total supply

        // Mint the maximum supply to the owner's account to initiate the cap test
        await mint.mintTo(ownerTokenAccount, owner.publicKey, [], totalSupply); // Minting max supply

        try {
            // Attempt to transfer an amount exceeding the wallet cap
            await program.methods
                .transfer(excessiveAmount) // Invoke the transfer method
                .accounts({
                    state: state, // Pass in the state account which has restrictions
                    sender: owner.publicKey, // Specify the sender (owner) account
                    receiver: ownerTokenAccount, // Specify the receiver account
                    burnWallet: burnWallet, // Specify the burn wallet
                    marketingWallet: marketingWallet, // Specify the marketing wallet
                    tokenProgram: TOKEN_PROGRAM_ID, // Reference to the SPL Token program
                })
                .signers([owner]) // Sign the transaction with the owner's keypair
                .rpc(); // Send the transaction
            assert.fail("Expected an error due to wallet cap exceeded but got success."); // Fail test if no error occurred
        } catch (error) {
            // Ensure the correct error code is thrown for exceeding the wallet cap
            assert.strictEqual(
                error.error.errorCode.code,
                "ExceedsWalletCap",
                "Error for exceeding wallet cap should trigger"
            );
        }
    });
});
