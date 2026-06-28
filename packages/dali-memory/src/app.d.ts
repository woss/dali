declare global {
  namespace App {
    interface Locals {
      authenticated?: boolean;
      userEmail?: string;
    }
  }
}

export {};
