// Blockchain and MetaMask integration utilities

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface BlockchainAccount {
  address: string;
  email: string;
  role: 'patient' | 'doctor';
  username: string;
}

// Check if MetaMask is installed
export const isMetaMaskInstalled = (): boolean => {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
};

// Connect to MetaMask
export const connectMetaMask = async (): Promise<string> => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install the MetaMask browser extension and try again.');
  }

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });

    if (!accounts || accounts.length === 0) {
      throw new Error('No MetaMask accounts found. Please unlock MetaMask and try again.');
    }

    return accounts[0];
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error('You rejected the MetaMask connection request. Please approve it to continue.');
    }
    if (error.code === -32002) {
      throw new Error('MetaMask connection is already pending. Please open MetaMask and approve the request.');
    }
    // Already has a good message (our own errors above)
    if (error.message && !error.message.includes('Failed to fetch')) {
      throw error;
    }
    throw new Error('Could not connect to MetaMask. Please make sure MetaMask is unlocked and try again.');
  }
};

// Get current connected account
export const getCurrentAccount = async (): Promise<string | null> => {
  if (!isMetaMaskInstalled()) {
    return null;
  }

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_accounts'
    });
    return accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    console.error('Error getting current account:', error);
    return null;
  }
};

// Generate a new blockchain account (simulated)
export const generateBlockchainAccount = async (): Promise<string> => {
  // In a real implementation, this would create a new wallet
  // For demo purposes, we'll connect to MetaMask
  return await connectMetaMask();
};

// Simulate blockchain transaction
export const sendBlockchainTransaction = async (
  from: string,
  to: string,
  data: any
): Promise<string> => {
  // Simulate transaction delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Generate a fake transaction hash
  const txHash = '0x' + Math.random().toString(16).substring(2, 66);

  return txHash;
};

// Listen for account changes
export const onAccountsChanged = (callback: (accounts: string[]) => void) => {
  if (!isMetaMaskInstalled()) {
    return;
  }

  window.ethereum.on('accountsChanged', callback);
};

// Remove account change listener
export const removeAccountsChangedListener = (callback: (accounts: string[]) => void) => {
  if (!isMetaMaskInstalled()) {
    return;
  }

  window.ethereum.removeListener('accountsChanged', callback);
};
