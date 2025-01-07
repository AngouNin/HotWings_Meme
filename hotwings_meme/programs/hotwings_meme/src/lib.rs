// // HotWings Memecoin Smart Contract - Solana Blockchain
// // Developed in Rust
// // Detailed comments included for clarity

// // Import necessary modules from Anchor framework and SPL token program
// use anchor_lang::prelude::*;
// use anchor_spl::token::{self, Token, TokenAccount, Transfer};

// // Declare the program ID for the smart contract
// declare_id!("F315xx75TiyxnGV4vAZssphVdauiYNA5bJThvKGty6Mj");

// // Define the program module
// #[program]
// pub mod hotwings_contract {
//     use super::*;

//     // Initialize the contract with the total supply of tokens
//     pub fn initialize(ctx: Context<Initialize>, total_supply: u64) -> Result<()> {
//         let state = &mut ctx.accounts.state; // Mutable reference to the contract state
//         state.owner = *ctx.accounts.owner.key; // Set the owner to the account invoking the function
//         state.total_supply = total_supply; // Set the total supply of the token
//         state.market_cap = 0; // Initialize market cap to zero
//         state.unlocks = vec![45000, 105500, 225000, 395000, 650000, 997000, 1574000, 2500000]; // Unlocked milestones
//         state.unlocked_percentages = vec![10, 10, 10, 10, 10, 10, 10, 30]; // Corresponding percentages for each milestone
//         state.current_milestone = 0; // Initialize current milestone
//         state.start_timestamp = Clock::get()?.unix_timestamp; // Record the start time of the contract
//         Ok(())
//     }

//     // Function to update the market cap of the token
//     pub fn update_market_cap(ctx: Context<UpdateMarketCap>, new_cap: u64) -> Result<()> {
//         let state = &mut ctx.accounts.state; // Mutable reference to the contract state
//         state.market_cap = new_cap; // Update market cap to the new value
//         // Call check_milestones to ensure milestones are updated
//         state.check_milestones()?; 
//         Ok(())
//     }

//     // Function to handle token transfers, including tax application and wallet restrictions
//     pub fn transfer(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
//         let state = &ctx.accounts.state; // Reference to the contract state

//         // Calculate the maximum holding allowed (5% of total supply)
//         let max_holding = state.total_supply * 5 / 100;
//         // Ensure that the receiver's current amount plus the transfer does not exceed the max holding
//         require!(
//             ctx.accounts.receiver.amount + amount <= max_holding,
//             ErrorCode::ExceedsWalletCap // Trigger error if cap exceeded
//         );

//         // Calculate the tax (1.5% of the transfer amount)
//         let tax = amount * 15 / 1000;
//         // Calculate the amount to be transferred after tax
//         let transfer_amount = amount - tax;

//         // Split the tax 50-50 between burning and marketing
//         let burn_amount = tax / 2;
//         let marketing_amount = tax / 2;

//         // Transfer the burned tokens to the burn wallet
//         token::transfer(
//             ctx.accounts.into_transfer_to_burn_context(),
//             burn_amount,
//         )?;
//         // Transfer the marketing tokens to the marketing wallet
//         token::transfer(
//             ctx.accounts.into_transfer_to_marketing_context(),
//             marketing_amount,
//         )?;

//         // Transfer the remaining tokens to the receiver
//         token::transfer(ctx.accounts.into_transfer_context(), transfer_amount)?;

//         Ok(())
//     }
// }

// // Define the State account structure to hold contract data
// #[account]
// pub struct State {
//     pub owner: Pubkey, // Public key of the owner
//     pub total_supply: u64, // Total supply of the token
//     pub market_cap: u64, // Current market cap of the token
//     pub unlocks: Vec<u64>, // Milestones for unlocks
//     pub unlocked_percentages: Vec<u8>, // Corresponding percentages for each milestone
//     pub current_milestone: usize, // Index of the current milestone
//     pub start_timestamp: i64, // Timestamp when the contract was initialized
// }

// impl State {
//     // Function to check milestones based on the current market cap
//     pub fn check_milestones(&mut self) -> Result<()> {
//         // Check if the market cap has passed the next milestone
//         while self.current_milestone < self.unlocks.len() && self.market_cap >= self.unlocks[self.current_milestone] {
//             // Logic to handle what happens when a milestone is reached
//             // This could involve unlocking tokens, increasing supply, or logging an event, etc.
            
//             // Move to the next milestone
//             self.current_milestone += 1;
//         }
//         Ok(())
//     }
// }

// // Define contexts for each function in the contract
// #[derive(Accounts)]
// pub struct Initialize<'info> {
//     #[account(init, payer = owner, space = 8 + 128)] // Initialize and allocate space for State account
//     pub state: Account<'info, State>, // Account holding contract state
//     #[account(mut)] // Owner account must be mutable
//     pub owner: Signer<'info>, // Owner's account who initialized the contract
//     pub system_program: Program<'info, System>, // Reference to the system program needed for account creation
// }

// #[derive(Accounts)]
// pub struct UpdateMarketCap<'info> {
//     #[account(mut)] // State account must be mutable for updating
//     pub state: Account<'info, State>, // Account holding contract state
//     pub owner: Signer<'info>, // Owner account invoking this function
// }

// #[derive(Accounts)]
// pub struct TransferTokens<'info> {
//     #[account(mut)] // State account must be mutable
//     pub state: Account<'info, State>, // Account holding contract state
//     #[account(mut)] // Sender's account must be mutable for token transfer
//     pub sender: Signer<'info>, // Account initiating the transfer
//     #[account(mut)] // Receiver's token account must also be mutable
//     pub receiver: Account<'info, TokenAccount>, // The account receiving the tokens
//     #[account(mut)] // Burn wallet account must be mutable
//     pub burn_wallet: Account<'info, TokenAccount>, // The account used for burning tokens
//     #[account(mut)] // Marketing wallet account must be mutable
//     pub marketing_wallet: Account<'info, TokenAccount>, // Account for marketing tokens
//     pub token_program: Program<'info, Token>, // Reference to the SPL Token program
// }

// // Helper functions to create CPI (Cross-Program Invocation) contexts for token transfers
// impl<'info> TransferTokens<'info> {
//     // Context for transferring tokens to the receiver
//     fn into_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
//         let cpi_accounts = Transfer {
//             from: self.sender.to_account_info(),
//             to: self.receiver.to_account_info(),
//             authority: self.sender.to_account_info(), // Sender is the authority
//         };
//         CpiContext::new(self.token_program.to_account_info(), cpi_accounts) // Return CPI context
//     }

//     // Context for transferring tokens to the burn wallet
//     fn into_transfer_to_burn_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
//         let cpi_accounts = Transfer {
//             from: self.sender.to_account_info(),
//             to: self.burn_wallet.to_account_info(),
//             authority: self.sender.to_account_info(), // Sender is the authority
//         };
//         CpiContext::new(self.token_program.to_account_info(), cpi_accounts) // Return CPI context
//     }

//     // Context for transferring tokens to the marketing wallet
//     fn into_transfer_to_marketing_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
//         let cpi_accounts = Transfer {
//             from: self.sender.to_account_info(),
//             to: self.marketing_wallet.to_account_info(),
//             authority: self.sender.to_account_info(), // Sender is the authority
//         };
//         CpiContext::new(self.token_program.to_account_info(), cpi_accounts) // Return CPI context
//     }
// }

// // Define custom error codes for the contract
// #[error_code]
// pub enum ErrorCode {
//     #[msg("Wallet cap exceeded.")] // Error triggered if wallet cap is exceeded
//     ExceedsWalletCap,
//     #[msg("Unauthorized action.")] // Error triggered by unauthorized actions
//     Unauthorized,
// }



// -----------------------------*-------------------------------
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("5RofsCGpCRjN6GfUYUguKLo2W1jzGZtYkGH7AopXrwVW");

/// Main program module
#[program]
pub mod hotwings {
    use super::*;

    /// Initialize the smart contract with the core configuration.
    pub fn initialize(
        ctx: Context<Initialize>,
        total_supply: u64,
        market_cap_oracle: Pubkey,
        project_wallet: Pubkey,
        marketing_wallet: Pubkey,
        burn_wallet: Pubkey,
    ) -> Result<()> {
        let state = &mut ctx.accounts.hotwings_state;

        // Initialize the global state of the program
        state.total_supply = total_supply;
        state.market_cap_oracle = market_cap_oracle;
        state.project_wallet = project_wallet;
        state.marketing_wallet = marketing_wallet;
        state.burn_wallet = burn_wallet;
        state.tax_rate_bps = 150; // 1.5% = 150 basis points
        state.tax_distribution = [75, 75]; // Tax split into 0.75% Burn and 0.75% Marketing
        state.wallet_cap = (total_supply * 5) / 100; // Set wallet cap to 5% of total supply

        // Define milestone unlocks
        state.milestones = vec![
            Milestone { cap: 45000, unlock_pct: 10, unlocked: false },
            Milestone { cap: 105500, unlock_pct: 10, unlocked: false },
            Milestone { cap: 225000, unlock_pct: 10, unlocked: false },
            Milestone { cap: 395000, unlock_pct: 10, unlocked: false },
            Milestone { cap: 650000, unlock_pct: 10, unlocked: false },
            Milestone { cap: 997000, unlock_pct: 10, unlocked: false },
            Milestone { cap: 1574000, unlock_pct: 10, unlocked: false },
            Milestone { cap: 2500000, unlock_pct: 100, unlocked: false },
        ];

        // Set a fallback unlock deadline (3 months after initialization)
        state.unlock_deadline = Clock::get()?.unix_timestamp + (3 * 30 * 24 * 60 * 60);

        Ok(())
    }

    /// Lock tokens for an investor. Tokens are locked until milestones are reached.
    pub fn lock_tokens(ctx: Context<LockTokens>, amount: u64) -> Result<()> {
        let investor = &mut ctx.accounts.investor;

        // Ensure valid lock amount
        require!(amount > 0, HotwingsError::InvalidLockAmount);

        // Lock the tokens for the investor
        investor.locked_amount += amount;

        Ok(())
    }

    /// Unlock tokens based on milestones achieved.
    pub fn unlock_tokens(
        ctx: Context<UnlockTokens>,
        current_market_cap: u64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.hotwings_state;
        let investor = &mut ctx.accounts.investor;

        let mut total_unlock = 0;

        // Iterate through milestones and unlock if conditions are met
        for milestone in &mut state.milestones {
            if current_market_cap >= milestone.cap && !milestone.unlocked {
                total_unlock += (investor.locked_amount * milestone.unlock_pct as u64) / 100;
                milestone.unlocked = true; // Prevent duplicate unlocks
            }
        }

        // Add unlocked tokens to the investor
        investor.unlocked_amount += total_unlock;

        Ok(())
    }

    pub fn apply_transaction_tax(
        ctx: Context<ApplyTransactionTax>,
        transaction_amount: u64,
    ) -> Result<()> {
        let state = &ctx.accounts.hotwings_state;
    
        // Calculate total tax
        let tax = (transaction_amount * state.tax_rate_bps as u64) / 10_000;
    
        // Split tax into burn and marketing shares
        let burn_share = (tax * state.tax_distribution[0]) / 100; // Calculate burn share
        let marketing_share = (tax * state.tax_distribution[1]) / 100; // Calculate marketing share
    
        // Create signer seeds for program authority (PDA)
        let bump = ctx.accounts.hotwings_state.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"hotwings_state", &[bump]]]; // Correct the seed format
    
        // Transfer tokens to burn wallet
        let burn_transfer_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.transfer_from_account.to_account_info(),
                to: ctx.accounts.burn_wallet.to_account_info(),
                authority: ctx.accounts.hotwings_state.to_account_info(), // PDA authority
            },
            signer_seeds,
        );
        token::transfer(burn_transfer_context, burn_share)?;
    
        // Transfer tokens to marketing wallet
        let marketing_transfer_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.transfer_from_account.to_account_info(),
                to: ctx.accounts.marketing_wallet.to_account_info(),
                authority: ctx.accounts.hotwings_state.to_account_info(), // PDA authority
            },
            signer_seeds,
        );
        token::transfer(marketing_transfer_context, marketing_share)?;
    
        Ok(())
    }
    

    /// Automatically sell 25% of the project's allocation
    pub fn auto_sell(ctx: Context<AutoSell>) -> Result<()> {
        let state = &ctx.accounts.hotwings_state;

        // Ensure either the final milestone is reached or the unlock deadline passed
        require!(
            state.milestones.last().unwrap().unlocked // Final milestone is reached
            || Clock::get()?.unix_timestamp >= state.unlock_deadline, // Unlock deadline is reached
            HotwingsError::AutoSellNotAllowed
        );

        // Placeholder: Calculate 25% of the project's allocation for the auto-sell
        // let sell_amount = ctx.accounts.project_wallet.amount / 4;

        // TODO: Integrate with a DEX (e.g., Jupiter, OpenBook) for token-to-SOL swaps

        Ok(())
    }
}

//////////////////////////////
// Structs and Accounts
//////////////////////////////

/// Global state of the HotWings program.
#[account]
pub struct HotwingsState {
    pub total_supply: u64,             // Total tokens in circulation
    pub market_cap_oracle: Pubkey,    // Price Oracle account
    pub project_wallet: Pubkey,       // Project wallet for proceeds
    pub marketing_wallet: Pubkey,     // Wallet for marketing tax funds
    pub burn_wallet: Pubkey,          // Burn wallet for tax-burned tokens
    pub tax_rate_bps: u16,            // Transaction tax (in basis points)
    pub tax_distribution: [u64; 2],   // Tax split percentages [Burn, Marketing]
    pub wallet_cap: u64,              // Max cap for an individual wallet
    pub milestones: Vec<Milestone>,   // Market cap milestones
    pub unlock_deadline: i64,         // 3-month fallback unlock period
    pub bump: u8,                     // PDA bump for authority
}

/// Investor account structure.
#[account]
pub struct Investor {
    pub locked_amount: u64,      // Tokens locked for the investor
    pub unlocked_amount: u64,    // Tokens unlocked for the investor
}

/// Market cap milestone structure.
#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct Milestone {
    pub cap: u64,        // Market cap required to trigger unlock
    pub unlock_pct: u8,  // Percent of tokens unlocked
    pub unlocked: bool,  // Whether this milestone is triggered
}

//////////////////////////////
// Context Structs
//////////////////////////////

/// Context for initializing the program.
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + 512, seeds = [b"hotwings_state"], bump)]
    pub hotwings_state: Account<'info, HotwingsState>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Context for locking tokens.
// #[derive(Accounts)]
// pub struct LockTokens<'info> {
//     #[account(mut)]
//     pub investor: Account<'info, Investor>,
//     #[account(mut)]
//     pub hotwings_state: Account<'info, HotwingsState>,
// }

#[derive(Accounts)]
pub struct LockTokens<'info> {
    #[account(mut, signer)] // Add `signer` constraint so `investor` must sign
    pub investor: Account<'info, Investor>,
    #[account(mut)]
    pub hotwings_state: Account<'info, HotwingsState>,
}


/// Context for unlocking tokens.
#[derive(Accounts)]
pub struct UnlockTokens<'info> {
    #[account(mut)]
    pub investor: Account<'info, Investor>,
    #[account(mut)]
    pub hotwings_state: Account<'info, HotwingsState>,
}

/// Context for applying transaction taxes.
#[derive(Accounts)]
pub struct ApplyTransactionTax<'info> {
    #[account(mut)]
    pub hotwings_state: Account<'info, HotwingsState>,
    #[account(mut)]
    pub burn_wallet: Account<'info, TokenAccount>,
    #[account(mut)]
    pub marketing_wallet: Account<'info, TokenAccount>,
    #[account(mut)]
    pub transfer_from_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

/// Context for auto-sell.
#[derive(Accounts)]
pub struct AutoSell<'info> {
    #[account(mut)]
    pub project_wallet: Account<'info, TokenAccount>, // Project wallet holding tokens
    #[account(mut)]
    pub hotwings_state: Account<'info, HotwingsState>, // Global state of the program
    pub token_program: Program<'info, Token>, // SPL token program for transfers
}

/// Custom errors for the HotWings program.
#[error_code]
pub enum HotwingsError {
    #[msg("Invalid amount for locking.")]
    InvalidLockAmount,
    #[msg("Auto-sell is not allowed yet.")]
    AutoSellNotAllowed,
    #[msg("Wallet holding exceeds maximum cap.")]
    ExceedsWalletCap,
}
