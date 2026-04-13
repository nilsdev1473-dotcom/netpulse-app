use sysinfo::Networks;
use std::process::Command;
use tauri::command;

#[derive(serde::Serialize, Clone)]
pub struct NetworkInterface {
    pub name: String,
    pub bytes_received: u64,
    pub bytes_transmitted: u64,
    pub rx_speed_mbps: f64,
    pub tx_speed_mbps: f64,
}

#[derive(serde::Serialize)]
pub struct ConnectionInfo {
    pub protocol: String,
    pub local_addr: String,
    pub remote_addr: String,
    pub state: String,
}

#[derive(serde::Serialize)]
pub struct IpInfo {
    pub ip: String,
    pub isp: String,
    pub org: String,
    pub country: String,
    pub city: String,
    pub timezone: String,
    pub vpn_detected: bool,
    pub vpn_confidence: u8,
}

#[command]
async fn get_network_stats() -> Vec<NetworkInterface> {
    let mut networks = Networks::new_with_refreshed_list();
    std::thread::sleep(std::time::Duration::from_millis(500));
    networks.refresh(false);

    networks
        .iter()
        .map(|(name, data)| NetworkInterface {
            name: name.clone(),
            bytes_received: data.total_received(),
            bytes_transmitted: data.total_transmitted(),
            rx_speed_mbps: (data.received() as f64 * 8.0) / 500_000.0,
            tx_speed_mbps: (data.transmitted() as f64 * 8.0) / 500_000.0,
        })
        .collect()
}

#[command]
async fn get_active_connections() -> Vec<ConnectionInfo> {
    let output = match Command::new("netstat")
        .args(["-an", "-p", "tcp"])
        .output()
    {
        Ok(o) => o,
        Err(_) => return vec![],
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .lines()
        .filter(|l| l.contains("ESTABLISHED") || l.contains("LISTEN"))
        .take(20)
        .map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            ConnectionInfo {
                protocol: parts.get(0).unwrap_or(&"tcp").to_string(),
                local_addr: parts.get(3).unwrap_or(&"-").to_string(),
                remote_addr: parts.get(4).unwrap_or(&"-").to_string(),
                state: parts.get(5).unwrap_or(&"-").to_string(),
            }
        })
        .collect()
}

#[command]
async fn get_ip_info() -> IpInfo {
    let vpn_orgs = [
        "datacamp", "packethub", "digitalocean", "mullvad", "nordvpn", "expressvpn",
        "protonvpn", "m247", "cloudflare", "linode", "vultr", "hetzner", "aeza", "leaseweb",
    ];

    let client = reqwest::Client::new();
    match client
        .get("http://ip-api.com/json/?fields=status,isp,org,country,city,timezone,query")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(resp) => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                let isp = json["isp"].as_str().unwrap_or("Unknown").to_lowercase();
                let org = json["org"].as_str().unwrap_or("Unknown").to_lowercase();
                let combined = format!("{} {}", isp, org);
                let vpn_detected = vpn_orgs.iter().any(|v| combined.contains(v));
                IpInfo {
                    ip: json["query"].as_str().unwrap_or("—").to_string(),
                    isp: json["isp"].as_str().unwrap_or("Unknown").to_string(),
                    org: json["org"].as_str().unwrap_or("Unknown").to_string(),
                    country: json["country"].as_str().unwrap_or("Unknown").to_string(),
                    city: json["city"].as_str().unwrap_or("Unknown").to_string(),
                    timezone: json["timezone"].as_str().unwrap_or("").to_string(),
                    vpn_detected,
                    vpn_confidence: if vpn_detected { 90 } else { 5 },
                }
            } else {
                IpInfo {
                    ip: "—".into(),
                    isp: "Unknown".into(),
                    org: "Unknown".into(),
                    country: "Unknown".into(),
                    city: "Unknown".into(),
                    timezone: "".into(),
                    vpn_detected: false,
                    vpn_confidence: 0,
                }
            }
        }
        Err(_) => IpInfo {
            ip: "—".into(),
            isp: "Offline".into(),
            org: "—".into(),
            country: "—".into(),
            city: "—".into(),
            timezone: "".into(),
            vpn_detected: false,
            vpn_confidence: 0,
        },
    }
}

#[command]
async fn measure_download_speed() -> f64 {
    let client = reqwest::Client::new();
    let start = std::time::Instant::now();
    match client
        .get("https://speed.cloudflare.com/__down?bytes=10000000")
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
    {
        Ok(resp) => {
            let bytes = resp.bytes().await.unwrap_or_default().len() as f64;
            let elapsed = start.elapsed().as_secs_f64();
            if elapsed > 0.0 {
                (bytes * 8.0) / (elapsed * 1_000_000.0)
            } else {
                0.0
            }
        }
        Err(_) => 0.0,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_network_stats,
            get_active_connections,
            get_ip_info,
            measure_download_speed,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
