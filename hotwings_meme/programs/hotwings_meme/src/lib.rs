// HotWings Memecoin Smart Contract - Solana Blockchain
// Developed in Rust
// Detailed comments included for clarity

// Import necessary modules from Anchor framework and SPL token program
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

// Declare the program ID for the smart contract
declare_id!("F315xx75TiyxnGV4vAZssphVdauiYNA5bJThvKGty6Mj");

// Define the program module
#[program]
pub mod hotwings_contract {
    use super::*;

    // Initialize the contract with the total supply of tokens
    pub fn initialize(ctx: Context<Initialize>, total_supply: u64) -> Result<()> {
        let state = &mut ctx.accounts.state; // Mutable reference to the contract state
        state.owner = *ctx.accounts.owner.key; // Set the owner to the account invoking the function
        state.total_supply = total_supply; // Set the total supply of the token
        state.market_cap = 0; // Initialize market cap to zero
        // Define the unlocking milestones and their corresponding percentages
        state.unlocks = vec![45000, 105500, 225000, 395000, 650000, 997000, 1574000, 2500000];
        state.unlocked_percentages = vec![10, 10, 10, 10, 10, 10, 10, 30];
        state.current_milestone = 0; // Initialize the current milestone
        state.start_timestamp = Clock::get()?.unix_timestamp; // Record the start time of the contract
        Ok(())
    }

    // Function to update the market cap of the token
    pub fn update_market_cap(ctx: Context<UpdateMarketCap>, new_cap: u64) -> Result<()> {
        let state = &mut ctx.accounts.state; // Mutable reference to the contract state
        state.market_cap = new_cap; // Update market cap to the new value
        state.check_milestones()?; // Check if any milestones need to be updated based on the new market cap
        Ok(())
    }

    // Function to handle token transfers, including tax application and wallet restrictions
    pub fn transfer(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
        let state = &ctx.accounts.state; // Reference to the contract state

        // Calculate the maximum holding allowed (5% of total supply)
        let max_holding = state.total_supply * 5 / 100;
        // Ensure that the receiver's current amount plus the transfer does not exceed the max holding
        require!(
            ctx.accounts.receiver.amount + amount <= max_holding,
            ErrorCode::ExceedsWalletCap // Trigger error if cap exceeded
        );

        // Calculate the tax (1.5% of the transfer amount)
        let tax = amount * 15 / 1000;
        // Calculate the amount to be transferred after tax
        let transfer_amount = amount - tax;

        // Split the tax 50-50 between burning and marketing
        let burn_amount = tax / 2;
        let marketing_amount = tax / 2;

        // Transfer the burned tokens to the burn wallet
        token::transfer(
            ctx.accounts.into_transfer_to_burn_context(),
            burn_amount,
        )?;
        // Transfer the marketing tokens to the marketing wallet
        token::transfer(
            ctx.accounts.into_transfer_to_marketing_context(),
            marketing_amount,
        )?;

        // Transfer the remaining tokens to the receiver
        token::transfer(ctx.accounts.into_transfer_context(), transfer_amount)?;

        Ok(())
    }
}

// Define the State account structure to hold contract data
#[account]
pub struct State {
    pub owner: Pubkey, // Public key of the owner
    pub total_supply: u64, // Total supply of the token
    pub market_cap: u64, // Current market cap of the token
    pub unlocks: Vec<u64>, // Milestones for unlocks
    pub unlocked_percentages: Vec<u8>, // Corresponding percentages for each milestone
    pub current_milestone: usize, // Index of the current milestone
    pub start_timestamp: i64, // Timestamp when the contract was initialized
}

// Define contexts for each function in the contract
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = owner, space = 8 + 128)] // Initialize and allocate space for State account
    pub state: Account<'info, State>, // Account holding contract state
    #[account(mut)] // Owner account must be mutable
    pub owner: Signer<'info>, // Owner's account who initialized the contract
    pub system_program: Program<'info, System>, // Reference to the system program needed for account creation
}

#[derive(Accounts)]
pub struct UpdateMarketCap<'info> {
    #[account(mut)] // State account must be mutable for updating
    pub state: Account<'info, State>, // Account holding contract state
    pub owner: Signer<'info>, // Owner account invoking this function
}

#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut)] // State account must be mutable
    pub state: Account<'info, State>, // Account holding contract state
    #[account(mut)] // Sender's account must be mutable for token transfer
    pub sender: Signer<'info>, // Account initiating the transfer
    #[account(mut)] // Receiver's token account must also be mutable
    pub receiver: Account<'info, TokenAccount>, // The account receiving the tokens
    #[account(mut)] // Burn wallet account must be mutable
    pub burn_wallet: Account<'info, TokenAccount>, // The account used for burning tokens
    #[account(mut)] // Marketing wallet account must be mutable
    pub marketing_wallet: Account<'info, TokenAccount>, // Account for marketing tokens
    pub token_program: Program<'info, Token>, // Reference to the SPL Token program
}

// Helper functions to create CPI (Cross-Program Invocation) contexts for token transfers
impl<'info> TransferTokens<'info> {
    // Context for transferring tokens to the receiver
    fn into_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.sender.to_account_info(),
            to: self.receiver.to_account_info(),
            authority: self.sender.to_account_info(), // Sender is the authority
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts) // Return CPI context
    }

    // Context for transferring tokens to the burn wallet
    fn into_transfer_to_burn_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.sender.to_account_info(),
            to: self.burn_wallet.to_account_info(),
            authority: self.sender.to_account_info(), // Sender is the authority
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts) // Return CPI context
    }

    // Context for transferring tokens to the marketing wallet
    fn into_transfer_to_marketing_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.sender.to_account_info(),
            to: self.marketing_wallet.to_account_info(),
            authority: self.sender.to_account_info(), // Sender is the authority
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts) // Return CPI context
    }
}

// Define custom error codes for the contract
#[error_code]
pub enum ErrorCode {
    #[msg("Wallet cap exceeded.")] // Error triggered if wallet cap is exceeded
    ExceedsWalletCap,
    #[msg("Unauthorized action.")] // Error triggered by unauthorized actions
    Unauthorized,
}
