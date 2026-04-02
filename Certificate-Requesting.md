# Feature: Certificate Requesting from step-ca

## Summary

From the MissionControl web interface "/ca" a user should be able to request either a TLS Certificate signed by the intermediate Certifiacate authority (Step-CA) or sign their SSH Key.
Both of these function should return the certificates to the user for download or copy and paste. 
Additional needs: 
- A list of TLS/SSL certificates should be avaliable to view with their experation date on the web interface.
- SSH Signed Certificates should not be stored.
- ONLY ADMIN USERS should be able to use either of these new functions or be able to see the table of certificates. 

Each feature should be independently tested through mock clients.

---

## Implementation Details

### Access Control
All certificate operations (`/api/ca/sign/tls`, `/api/ca/sign/ssh`, `/api/ca/certificates`) are admin-only, protected by both `require_auth` and `require_admin` middleware.

### TLS Certificate Flow
- The backend generates an EC P-256 key pair and CSR using the `rcgen` crate.
- A one-time provisioner token (JWT, ES256) is minted using `STEP_CA_PROVISIONER_KEY_PEM` and `STEP_CA_PROVISIONER_NAME`, then sent alongside the CSR to step-ca `/1.0/sign`.
- The signed cert PEM and private key PEM are returned to the admin for immediate download (two files: `<cn>.crt` and `<cn>.key`).
- Only metadata is stored in MongoDB (`issued_certificates` collection): common name, SANs, serial, expiry, requested-by user ID + email, issued-at timestamp. The cert PEM is **not** stored.

### SSH Certificate Flow
- The admin pastes an SSH public key and enters comma-separated principals in the form.
- A provisioner token is minted with `aud: .../1.0/ssh/sign` and POSTed to step-ca along with the public key, cert type (`user`), key ID (admin's email), and principals.
- The signed SSH certificate is returned inline (displayed in a textarea with copy/download). **Nothing is stored.**

### Required Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `STEP_CA_PROVISIONER_NAME` | Yes | Name of the JWK provisioner in step-ca |
| `STEP_CA_PROVISIONER_KEY_PEM` | Yes | EC private key (PKCS8 PEM) corresponding to the JWK provisioner |

The provisioner private key must be in PKCS8 PEM format (EC P-256). Extract from step-ca's `secrets/` directory using `step crypto key format`.

### MongoDB Collection
`issued_certificates` — stores TLS cert metadata with an index on `(requested_by, issued_at)`.
