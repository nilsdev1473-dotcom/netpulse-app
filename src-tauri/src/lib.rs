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
        .invoke_handler(tauri::generate_handler![get_process_network_stats, 
            get_network_stats,
            get_active_connections,
            get_ip_info,
            measure_download_speed,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(serde::Serialize, Clone)]
pub struct ProcessNetStat {
    pub pid: u32,
    pub name: String,
    pub rx_bytes_per_sec: f64,
    pub tx_bytes_per_sec: f64,
    pub connections: u32,
    pub icon_path: Option<String>,
}

#[tauri::command]
async fn get_process_network_stats() -> Vec<ProcessNetStat> {
    // Use nettop for per-process network stats (macOS only, no root needed)
    let output = std::process::Command::new("nettop")
        .args(["-P", "-L", "1", "-k", "time,interface,state,rx_dupe,rx_ooo,re-tx,rtt_avg,rcvsize,tx_win,tc_class,tc_mgt,cc_algo,P,arch,piduid,rx_bytes,tx_bytes,conn_count"])
        .output();
    
    let mut results: Vec<ProcessNetStat> = Vec::new();
    
    if let Ok(output) = output {
        let text = String::from_utf8_lossy(&output.stdout);
        let mut lines = text.lines();
        
        // Skip header lines (first 2)
        lines.next(); lines.next();
        
        for line in lines.take(20) {
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() < 4 { continue; }
            
            let name = parts.get(0).unwrap_or(&"").trim().to_string();
            if name.is_empty() || name == "nettop" { continue; }
            
            // Try to parse PID from name (format: "ProcessName.PID")
            let (proc_name, pid) = if let Some(dot_pos) = name.rfind('.') {
                let pid_str = &name[dot_pos+1..];
                if let Ok(p) = pid_str.parse::<u32>() {
                    (name[..dot_pos].to_string(), p)
                } else {
                    (name.clone(), 0)
                }
            } else {
                (name.clone(), 0)
            };
            
            // Find app icon path
            let icon_path = find_app_icon(&proc_name);
            
            results.push(ProcessNetStat {
                pid,
                name: proc_name,
                rx_bytes_per_sec: 0.0, // nettop parsing is complex, use 0 for now
                tx_bytes_per_sec: 0.0,
                connections: 1,
                icon_path,
            });
        }
    }
    
    // Fallback: use lsof for connection counts per process
    if results.is_empty() {
        let lsof = std::process::Command::new("lsof")
            .args(["-i", "-n", "-P", "-F", "pcn"])
            .output();
        
        if let Ok(out) = lsof {
            let text = String::from_utf8_lossy(&out.stdout);
            let mut proc_map: std::collections::HashMap<String, (u32, u32)> = std::collections::HashMap::new();
            let mut current_name = String::new();
            let mut current_pid = 0u32;
            
            for line in text.lines() {
                if line.starts_with('p') { current_pid = line[1..].parse().unwrap_or(0); }
                else if line.starts_with('c') { current_name = line[1..].to_string(); }
                else if line.starts_with('n') {
                    let entry = proc_map.entry(current_name.clone()).or_insert((current_pid, 0));
                    entry.1 += 1;
                }
            }
            
            for (name, (pid, conns)) in proc_map.iter() {
                if *conns == 0 { continue; }
                let icon_path = find_app_icon(name);
                results.push(ProcessNetStat {
                    pid: *pid,
                    name: name.clone(),
                    rx_bytes_per_sec: 0.0,
                    tx_bytes_per_sec: 0.0,
                    connections: *conns,
                    icon_path,
                });
            }
            results.sort_by(|a, b| b.connections.cmp(&a.connections));
            results.truncate(15);
        }
    }
    
    results
}

fn find_app_icon(process_name: &str) -> Option<String> {
    let candidates = [
        format!("/Applications/{}.app/Contents/Resources/AppIcon.icns", process_name),
        format!("/Applications/{}.app/Contents/Resources/{}.icns", process_name, process_name),
        format!("/System/Applications/{}.app/Contents/Resources/AppIcon.icns", process_name),
    ];
    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return Some(path.clone());
        }
    }
    None
}
