import httpx2
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

from practice_api.apns import APNs


@pytest.fixture
def key(tmp_path):
    private = ec.generate_private_key(ec.SECP256R1())
    path = tmp_path / "test.p8"
    path.write_bytes(private.private_bytes(serialization.Encoding.PEM,
                     serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    path.chmod(0o600)
    return path, private.public_key()


def test_signed_payload_and_token_reuse(key):
    now = [2000000000]
    requests = []
    def handler(request):
        requests.append(request)
        return httpx2.Response(200)
    sender = APNs(key[0], "KEY", "TEAM", clock=lambda: now[0],
                  client=httpx2.Client(transport=httpx2.MockTransport(handler)))
    assert sender.send("ab" * 32, "a" * 64, "class-1").state == "accepted"
    request = requests[0]
    token = request.headers["authorization"].split()[1]
    claims = jwt.decode(token, key[1], algorithms=["ES256"], options={"verify_iat": False})
    assert claims == {"iss": "TEAM", "iat": now[0]}
    assert request.url.host == "api.push.apple.com"
    assert request.headers["apns-expiration"] == "0"
    assert request.headers["apns-topic"] == "ai.mypraxis.quietpractice"
    now[0] += 1200
    assert sender.authorization() == f"bearer {token}"
    now[0] += 1800
    assert sender.authorization() != f"bearer {token}"


@pytest.mark.parametrize("reason,invalid", [("Unregistered", True), ("BadDeviceToken", True),
                                          ("ExpiredProviderToken", False)])
def test_rejected_tokens(key, reason, invalid):
    client = httpx2.Client(transport=httpx2.MockTransport(
        lambda r: httpx2.Response(400, json={"reason": reason})))
    result = APNs(key[0], "KEY", "TEAM", client=client).send("ab" * 32, "key", "id")
    assert result.state == "rejected"
    assert result.invalid_token is invalid


def test_network_uncertainty_and_permissions(key):
    def fail(request):
        raise httpx2.ReadTimeout("test", request=request)
    sender = APNs(key[0], "KEY", "TEAM", client=httpx2.Client(transport=httpx2.MockTransport(fail)))
    assert sender.send("ab" * 32, "key", "id").state == "unknown"
    key[0].chmod(0o644)
    with pytest.raises(ValueError):
        APNs(key[0], "KEY", "TEAM")
