"""Run locally, then copy the output into your backend's secret environment setting."""

from cryptography.fernet import Fernet

if __name__ == "__main__":
    print(Fernet.generate_key().decode())
