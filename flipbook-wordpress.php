<?php
/**
 * Plugin Name: Flipbook PDF WordPress - Compresión
 * Description: Este plugin se encarga de que al subir un PDF a WordPress, se comprima reduciendo su tamaño sin perder calidad visual. Ideal para flipbooks.
 * Version: 3.0
 * Author: Eduardo Velasquez
 * Author URI: https://github.com/Eduardo-Ve
 * License: GPL2
 * Update URI: https://github.com/Eduardo-Ve/flipbook-wordpress/
 * Requires PHP: 7.4
 * Plugin URI: https://contraplano.cl/
 */

if (!defined('ABSPATH')) {
    exit;
}


define('FBW_VERSION', '2.2');
define('FBW_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('FBW_PLUGIN_URL', plugin_dir_url(__FILE__));

// 
// CONFIGURACIÓN DEL PLUGIN
// 

add_action('admin_menu', function () {
    add_options_page(
        'Flipbook PDF Settings',
        'Flipbook PDF',
        'manage_options',
        'flipbook-pdf-settings',
        'fbw_render_settings_page'
    );
});

add_action('admin_init', function () {
    register_setting('fbw_settings_group', 'fbw_ilovepdf_public_key', [
        'type' => 'string',
        'sanitize_callback' => 'sanitize_text_field'
    ]);
    
    register_setting('fbw_settings_group', 'fbw_ilovepdf_secret_key', [
        'type' => 'string',
        'sanitize_callback' => 'sanitize_text_field'
    ]);
    
    register_setting('fbw_settings_group', 'fbw_compression_enabled', [
        'type' => 'boolean',
        'default' => true,
        'sanitize_callback' => 'rest_sanitize_boolean'
    ]);
    
    register_setting('fbw_settings_group', 'fbw_compression_level', [
        'type' => 'string',
        'default' => 'recommended',
        'sanitize_callback' => 'sanitize_text_field'
    ]);
    
    register_setting('fbw_settings_group', 'fbw_max_file_size', [
        'type' => 'integer',
        'default' => 50,
        'sanitize_callback' => 'absint'
    ]);
    register_setting('fbw_settings_group', 'fbw_min_file_size', [
    'type' => 'integer',
    'default' => 1,
    'sanitize_callback' => 'absint'
    ]);
});

function fbw_render_settings_page() {
    $public_key = get_option('fbw_ilovepdf_public_key', '');
    $secret_key = get_option('fbw_ilovepdf_secret_key', '');
    $compression_enabled = get_option('fbw_compression_enabled', true);
    $compression_level = get_option('fbw_compression_level', 'recommended');
    $max_file_size = get_option('fbw_max_file_size', 50);
    $min_file_size = get_option('fbw_min_file_size', 1);


    
    $stats = get_option('fbw_compression_stats', [
        'total_compressions' => 0,
        'total_savings_bytes' => 0
    ]);
    
    // Test de conexión API
    $api_status = '';
    if (!empty($public_key) && !empty($secret_key)) {
        $test_result = fbw_test_api_connection($public_key, $secret_key);
        if ($test_result['success']) {
            $api_status = '<div style="background: #d4edda; border-left: 4px solid #28a745; padding: 12px; margin: 15px 0; border-radius: 4px;">
                <strong style="color: #155724;">Conexión API exitosa</strong><br>
            </div>';
        } else {
            $api_status = '<div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 12px; margin: 15px 0; border-radius: 4px;">
                <strong style="color: #721c24;">Error de conexión</strong><br>
                <small style="color: #721c24;">' . esc_html($test_result['message']) . '</small>
            </div>';
        }
    }
    ?>
    <div class="wrap">
        <h1>Flipbook PDF - Configuración</h1>
        
        <?php echo $api_status; ?>
        
        <?php if ($stats['total_compressions'] > 0): ?>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin: 0; color: white;">Compresión Universal Activa</h2>
            <p style="margin: 10px 0 0;">
                Has comprimido <strong><?php echo $stats['total_compressions']; ?></strong> PDFs y ahorrado 
                <strong><?php echo size_format($stats['total_savings_bytes']); ?></strong> de espacio.
            </p>
        </div>
        <?php endif; ?>
        
        <form method="post" action="options.php">
            <?php settings_fields('fbw_settings_group'); ?>
            
            <h2>API de iLovePDF</h2>
            <table class="form-table">
                <tr>
                    <th scope="row">Public Key</th>
                    <td>
                        <input 
                            type="text" 
                            name="fbw_ilovepdf_public_key"
                            class="regular-text"
                            value="<?php echo esc_attr($public_key); ?>"
                            placeholder="project_public_xxxxx"
                        />
                        <p class="description">
                            Obtén la API Key <a href="https://developer.ilovepdf.com/" target="_blank">Aquí</a>
                        </p>
                    </td>
                </tr>
                
                <tr>
                    <th scope="row">Secret Key</th>
                    <td>
                        <input 
                            type="password" 
                            id="fbw_secret_key"
                            name="fbw_ilovepdf_secret_key"
                            class="regular-text"
                            value="<?php echo esc_attr($secret_key); ?>"
                            placeholder="secret_key_xxxxx"
                        />
                        <button type="button" class="button" onclick="
                            var input = document.getElementById('fbw_secret_key');
                            input.type = input.type === 'password' ? 'text' : 'password';
                            this.textContent = input.type === 'password' ? 'Mostrar' : 'Ocultar';
                        ">Mostrar</button>
                        <p class="description">
                            Tu Secret Key generada
                        </p>
                    </td>
                </tr>
            </table>
            
            <h2>Configuración de Compresión</h2>
            <table class="form-table">
                <tr>
                    <th scope="row">Compresión Automática</th>
                    <td>
                        <label>
                            <input type="checkbox" name="fbw_compression_enabled" value="1" <?php checked($compression_enabled); ?>>
                            Comprimir <strong>TODOS</strong> los PDFs automáticamente al subirlos
                        </label>
                        <p class="description">
                            Aplica a cualquier PDF subido a WordPress, no solo flipbooks
                        </p>
                    </td>
                </tr>
                
                <tr>
                    <th scope="row">Nivel de Compresión</th>
                    <td>
                        <select name="fbw_compression_level">
                            <option value="low" <?php selected($compression_level, 'low'); ?>>
                                Baja - Máxima calidad, menos compresión
                            </option>
                            <option value="recommended" <?php selected($compression_level, 'recommended'); ?>>
                                Recomendada - Balance óptimo (predeterminado)
                            </option>
                            <option value="extreme" <?php selected($compression_level, 'extreme'); ?>>
                                Extrema - Máxima compresión, menor calidad
                            </option>
                        </select>
                        <p class="description">
                            <strong>Recomendada</strong> ofrece el mejor balance entre tamaño y calidad
                        </p>
                    </td>
                </tr>
                
                <tr>
                    <th scope="row">Tamaño Máximo</th>
                    <td>
                        <input 
                            type="number" 
                            name="fbw_max_file_size"
                            value="<?php echo esc_attr($max_file_size); ?>"
                            min="1"
                            max="200"
                            style="width: 100px;"
                        /> MB
                        <p class="description">
                            PDFs mayores a este tamaño no se comprimirán automáticamente
                        </p>
                    </td>
                </tr>
                <th scope="row">Tamaño Mínimo</th>
<td>
    <input 
        type="number" 
        name="fbw_min_file_size"
        value="<?php echo esc_attr($min_file_size); ?>"
        min="1"
        max="200"
        style="width: 100px;"
    /> MB
    <p class="description">
        PDFs menores a este tamaño no se comprimirán
    </p>
</td>
            </table>
            
            <?php submit_button('Guardar Configuración'); ?>
        </form>
        
        <hr style="margin: 30px 0;">
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div style="background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h2>Cómo usar el Flipbook</h2>
                <ol style="line-height: 1.8;">
                    <li><strong>Sube un PDF:</strong> Medios &rarr; Añadir nuevo</li>
                    <li><strong>Edita una Serie:</strong> Busca el metabox "PDF Flipbook"</li>
                    <li><strong>Selecciona el PDF:</strong> Click en "Seleccionar PDF"</li>
                    <li><strong>Ajusta dimensiones:</strong> 450 x 600 px (recomendado)</li>
                    <li><strong>Publica:</strong> El flipbook aparece automáticamente</li>
                </ol>
                
                <h3>Shortcode Manual</h3>
                <code>[flipbook_pdf id="123" width="450" height="600"]</code>
            </div>
            
            <div style="background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h2>Obtener API Key de iLovePDF</h2>
                <ol style="line-height: 1.8;">
                    <li>Ve a <a href="https://developer.ilovepdf.com/" target="_blank">developer.ilovepdf.com</a></li>
                    <li>Crea una cuenta gratuita</li>
                    <li>Ve a "Projects" &rarr; "Create new project"</li>
                    <li>Copia tu <strong>Public Key</strong> y <strong>Secret Key</strong></li>
                    <li>Pégalas arriba y guarda</li>
                </ol>
                
                <div style="background: #e7f3ff; padding: 10px; border-radius: 4px; margin-top: 10px;">
                    <strong>Plan Gratuito:</strong><br>
                    250 archivos/mes gratis<br>
                </div>
            </div>
        </div>

    </div>
    
    <style>
        .wrap h2 { margin-top: 30px; color: #2271b1; }
        .wrap ol { margin-left: 20px; }
        .wrap ul { margin-left: 20px; }
    </style>
    <?php
}

// 
// TEST DE CONEXIÓN API
// 

function fbw_test_api_connection($public_key, $secret_key) {
    try {
        $response = wp_remote_post('https://api.ilovepdf.com/v1/auth', [
            'body' => json_encode([
                'public_key' => $public_key
            ]),
            'headers' => [
                'Content-Type' => 'application/json'
            ],
            'timeout' => 15
        ]);
        
        if (is_wp_error($response)) {
            return [
                'success' => false,
                'message' => $response->get_error_message()
            ];
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (!isset($data['token'])) {
            return [
                'success' => false,
                'message' => isset($data['error']) ? $data['error'] : 'No se pudo obtener token'
            ];
        }
        
        return [
            'success' => true,
            'token' => $data['token'],
            'credits' => isset($data['credits']) ? $data['credits'] : null
        ];
        
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => $e->getMessage()
        ];
    }
}

// 
// COMPRESIÓN CON iLovePDF API
// 

add_filter('wp_handle_upload', 'fbw_compress_pdf_with_ilovepdf');

function fbw_compress_pdf_with_ilovepdf($upload) {
    // Solo procesar PDFs
    if ($upload['type'] !== 'application/pdf') {
        return $upload;
    }
    
    // Verificar si la compresión está habilitada
    if (!get_option('fbw_compression_enabled', true)) {
        error_log('FBW: Compresión deshabilitada en configuración');
        return $upload;
    }
    
    // Verificar API keys
    $public_key = get_option('fbw_ilovepdf_public_key');
    $secret_key = get_option('fbw_ilovepdf_secret_key');
    
    if (empty($public_key) || empty($secret_key)) {
        error_log('FBW: API keys no configuradas - Configurar en Ajustes -> Flipbook PDF');
        return $upload;
    }
    
    $original_file = $upload['file'];
    $original_size = filesize($original_file);
    
    // Verificar límite de tamaño
    $min_size = get_option('fbw_min_file_size', 1) * 1024 * 1024;
    if ($original_size < $min_size) {
        error_log(sprintf(
            'FBW: PDF demasiado pequeño (%s) - Mínimo: %s',
            size_format($original_size),
            size_format($min_size)
        ));
        return $upload;
    }
    
    error_log(sprintf(
        'FBW: Iniciando compresión de PDF (%s) - %s',
        basename($original_file),
        size_format($original_size)
    ));
    
    try {
        // Comprimir con iLovePDF
        $compressed_file = fbw_ilovepdf_compress($original_file, $public_key, $secret_key);
        
        if ($compressed_file && file_exists($compressed_file)) {
            $compressed_size = filesize($compressed_file);
            $savings = $original_size - $compressed_size;
            $savings_percent = round(($savings / $original_size) * 100);
            
            error_log(sprintf(
                'FBW: Resultado - Original: %s | Comprimido: %s | Ahorro: %d%%',
                size_format($original_size),
                size_format($compressed_size),
                $savings_percent
            ));
            
            // Solo reemplazar si hay ahorro significativo (>5%)
            if ($savings_percent > 5) {
                
                // Reemplazar el archivo original con el comprimido
                if (rename($compressed_file, $original_file)) {
                    error_log(sprintf(
                        'FBW: PDF comprimido exitosamente - Ahorro: %d%% (%s -> %s)',
                        $savings_percent,
                        size_format($original_size),
                        size_format($compressed_size)
                    ));
                    
                    // Actualizar el tamaño en el array de upload
                    $upload['size'] = $compressed_size;
                    
                    // Actualizar estadísticas
                    fbw_update_compression_stats($savings);
                    
                    // Guardar en transient temporal para el hook add_attachment
                    set_transient(
                        'fbw_compress_' . md5($original_file), 
                        [
                            'savings_percent' => $savings_percent,
                            'original_size' => $original_size,
                            'compressed_size' => $compressed_size
                        ],
                        300 // 5 minutos
                    );
                    
                    // Guardar metadata (se usa después en el hook add_attachment)
                    $upload['fbw_compressed'] = true;
                    $upload['fbw_savings_percent'] = $savings_percent;
                    $upload['fbw_original_size'] = $original_size;
                    $upload['fbw_compressed_size'] = $compressed_size;
                    
                } else {
                    error_log('FBW: Error al reemplazar archivo original');
                    @unlink($compressed_file);
                }
            } else {
                error_log('FBW: Ahorro mínimo (' . $savings_percent . '%), archivo no reemplazado');
                @unlink($compressed_file);
            }
        }
    } catch (Exception $e) {
        error_log('FBW: Error en compresión - ' . $e->getMessage());
    }
    
    return $upload;
}

function fbw_ilovepdf_compress($file_path, $public_key, $secret_key) {
    $compression_level = get_option('fbw_compression_level', 'recommended');
    
    error_log('FBW: Iniciando proceso de compresión...');
    error_log('FBW: Public Key: ' . substr($public_key, 0, 20) . '...');
    
    // 1. Obtener token de autenticación
    $auth_response = wp_remote_post('https://api.ilovepdf.com/v1/auth', [
        'body' => json_encode([
            'public_key' => $public_key
        ]),
        'headers' => [
            'Content-Type' => 'application/json'
        ],
        'timeout' => 30,
        'sslverify' => true
    ]);
    
    if (is_wp_error($auth_response)) {
        throw new Exception('Error de conexión en auth: ' . $auth_response->get_error_message());
    }
    
    $auth_body = wp_remote_retrieve_body($auth_response);
    $auth_code = wp_remote_retrieve_response_code($auth_response);
    
    error_log('FBW: Auth HTTP Code: ' . $auth_code);
    
    if ($auth_code !== 200) {
        throw new Exception('Error HTTP ' . $auth_code . ' en autenticación: ' . $auth_body);
    }
    
    $auth_data = json_decode($auth_body, true);
    
    if (!isset($auth_data['token'])) {
        $error_msg = isset($auth_data['error']) ? json_encode($auth_data['error']) : 'Token no disponible';
        throw new Exception('Error de autenticación: ' . $error_msg);
    }
    
    $token = $auth_data['token'];
    error_log('FBW: Token obtenido');
    
    // 2. Iniciar tarea de compresión
    error_log('FBW: Iniciando tarea de compresión...');
    
    $start_response = wp_remote_get('https://api.ilovepdf.com/v1/start/compress', [
        'headers' => [
            'Authorization' => 'Bearer ' . $token
        ],
        'timeout' => 30
    ]);
    
    if (is_wp_error($start_response)) {
        throw new Exception('Error al iniciar tarea: ' . $start_response->get_error_message());
    }
    
    $start_code = wp_remote_retrieve_response_code($start_response);
    $start_body = wp_remote_retrieve_body($start_response);
    
    error_log('FBW: Start HTTP Code: ' . $start_code);
    
    // Si el endpoint /start/compress da 404, intentar con el flujo alternativo
    if ($start_code === 404) {
        error_log('FBW: Endpoint /start/compress no disponible, usando flujo alternativo...');
        
        // Intentar con el endpoint base
        $start_response = wp_remote_post('https://api.ilovepdf.com/v1/task', [
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json'
            ],
            'body' => json_encode([
                'tool' => 'compress'
            ]),
            'timeout' => 30
        ]);
        
        if (is_wp_error($start_response)) {
            throw new Exception('Error en endpoint alternativo: ' . $start_response->get_error_message());
        }
        
        $start_code = wp_remote_retrieve_response_code($start_response);
        $start_body = wp_remote_retrieve_body($start_response);
        
        error_log('FBW: Alternative Start HTTP Code: ' . $start_code);
    }
    
    if ($start_code !== 200) {
        throw new Exception('Error HTTP ' . $start_code . ' al iniciar tarea: ' . $start_body);
    }
    
    $start_data = json_decode($start_body, true);
    
    if (!isset($start_data['task']) || !isset($start_data['server'])) {
        error_log('FBW: Estructura de start_data: ' . print_r($start_data, true));
        throw new Exception('Respuesta inválida: ' . $start_body);
    }
    
    $task_id = $start_data['task'];
    $server = $start_data['server'];
    
    error_log('FBW: Tarea iniciada - Task: ' . $task_id . ' | Server: ' . $server);
    
    // 3. Subir archivo
    error_log('FBW: Subiendo archivo al servidor ' . $server . '...');
    
    $upload_url = "https://{$server}/v1/upload";
    $filename = basename($file_path);
    
    // Usar CURLFile si está disponible (más confiable)
    if (function_exists('curl_init')) {
        $result = fbw_upload_with_curl($upload_url, $token, $task_id, $file_path);
    } else {
        // Fallback a wp_remote_post
        $result = fbw_upload_with_wp_remote($upload_url, $token, $task_id, $file_path);
    }
    
    if (!$result['success']) {
        throw new Exception($result['error']);
    }
    
    $server_filename = $result['server_filename'];
    error_log('FBW: Archivo subido - Server filename: ' . $server_filename);
    
    // 4. Procesar compresión
    error_log('FBW: Procesando compresión (nivel: ' . $compression_level . ')...');
    
    $process_response = wp_remote_post("https://{$server}/v1/process", [
        'headers' => [
            'Authorization' => 'Bearer ' . $token,
            'Content-Type' => 'application/json'
        ],
        'body' => json_encode([
            'task' => $task_id,
            'tool' => 'compress',
            'files' => [
                [
                    'server_filename' => $server_filename,
                    'filename' => $filename
                ]
            ],
            'compression_level' => $compression_level
        ]),
        'timeout' => 120
    ]);
    
    if (is_wp_error($process_response)) {
        throw new Exception('Error al procesar: ' . $process_response->get_error_message());
    }
    
    $process_code = wp_remote_retrieve_response_code($process_response);
    $process_body = wp_remote_retrieve_body($process_response);
    
    error_log('FBW: Process HTTP Code: ' . $process_code);
    
    if ($process_code !== 200) {
        throw new Exception('Error HTTP ' . $process_code . ' al procesar: ' . $process_body);
    }
    
    error_log('FBW: Compresión procesada');
    
    // 5. Descargar archivo comprimido
    error_log('FBW: Descargando archivo comprimido...');
    
    $download_response = wp_remote_get("https://{$server}/v1/download/{$task_id}", [
        'headers' => [
            'Authorization' => 'Bearer ' . $token
        ],
        'timeout' => 120
    ]);
    
    if (is_wp_error($download_response)) {
        throw new Exception('Error al descargar: ' . $download_response->get_error_message());
    }
    
    $download_code = wp_remote_retrieve_response_code($download_response);
    
    if ($download_code !== 200) {
        $download_body = wp_remote_retrieve_body($download_response);
        throw new Exception('Error HTTP ' . $download_code . ' al descargar: ' . $download_body);
    }
    
    $downloaded_content = wp_remote_retrieve_body($download_response);
    
    if (empty($downloaded_content)) {
        throw new Exception('Archivo descargado está vacío');
    }
    
    error_log('FBW: Descargado (' . size_format(strlen($downloaded_content)) . ')');
    
    // 6. Guardar archivo comprimido
    $temp_file = $file_path . '.compressed.pdf';
    file_put_contents($temp_file, $downloaded_content);
    
    if (!file_exists($temp_file) || filesize($temp_file) < 1024) {
        @unlink($temp_file);
        throw new Exception('Archivo comprimido inválido');
    }
    
    // Verificar que sea PDF válido
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $temp_file);
        finfo_close($finfo);
        
        if ($mime !== 'application/pdf') {
            @unlink($temp_file);
            throw new Exception('El archivo no es PDF válido (mime: ' . $mime . ')');
        }
    }
    
    error_log('FBW: Compresión completada exitosamente');
    
    return $temp_file;
}

// Función helper para subir con CURL (más confiable)
function fbw_upload_with_curl($upload_url, $token, $task_id, $file_path) {
    $ch = curl_init();
    
    $cfile = new CURLFile($file_path, 'application/pdf', basename($file_path));
    
    $post_data = [
        'task' => $task_id,
        'file' => $cfile
    ];
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $upload_url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $post_data,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token
        ],
        CURLOPT_TIMEOUT => 120
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    
    curl_close($ch);
    
    if ($error) {
        return ['success' => false, 'error' => 'CURL error: ' . $error];
    }
    
    error_log('FBW: Upload HTTP Code: ' . $http_code);
    
    if ($http_code !== 200) {
        return ['success' => false, 'error' => 'Error HTTP ' . $http_code . ' al subir: ' . $response];
    }
    
    $data = json_decode($response, true);
    
    if (!isset($data['server_filename'])) {
        return ['success' => false, 'error' => 'No se recibió server_filename: ' . $response];
    }
    
    return ['success' => true, 'server_filename' => $data['server_filename']];
}

// Función helper para subir con wp_remote_post (fallback)
function fbw_upload_with_wp_remote($upload_url, $token, $task_id, $file_path) {
    $boundary = wp_generate_password(24, false);
    $file_contents = file_get_contents($file_path);
    $filename = basename($file_path);
    
    $body = "--{$boundary}\r\n";
    $body .= "Content-Disposition: form-data; name=\"task\"\r\n\r\n";
    $body .= "{$task_id}\r\n";
    $body .= "--{$boundary}\r\n";
    $body .= "Content-Disposition: form-data; name=\"file\"; filename=\"{$filename}\"\r\n";
    $body .= "Content-Type: application/pdf\r\n\r\n";
    $body .= $file_contents . "\r\n";
    $body .= "--{$boundary}--\r\n";
    
    $response = wp_remote_post($upload_url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $token,
            'Content-Type' => 'multipart/form-data; boundary=' . $boundary
        ],
        'body' => $body,
        'timeout' => 120
    ]);
    
    if (is_wp_error($response)) {
        return ['success' => false, 'error' => 'Error al subir: ' . $response->get_error_message()];
    }
    
    $upload_body = wp_remote_retrieve_body($response);
    $upload_code = wp_remote_retrieve_response_code($response);
    
    error_log('FBW: Upload HTTP Code: ' . $upload_code);
    
    if ($upload_code !== 200) {
        return ['success' => false, 'error' => 'Error HTTP ' . $upload_code . ': ' . $upload_body];
    }
    
    $data = json_decode($upload_body, true);
    
    if (!isset($data['server_filename'])) {
        return ['success' => false, 'error' => 'No se recibió server_filename: ' . $upload_body];
    }
    
    return ['success' => true, 'server_filename' => $data['server_filename']];
}

function fbw_update_compression_stats($savings_bytes) {
    $stats = get_option('fbw_compression_stats', [
        'total_compressions' => 0,
        'total_savings_bytes' => 0,
        'last_compression' => null
    ]);
    
    $stats['total_compressions']++;
    $stats['total_savings_bytes'] += $savings_bytes;
    $stats['last_compression'] = current_time('mysql');
    
    update_option('fbw_compression_stats', $stats);
}

// Hook para actualizar metadatos después de adjuntar
add_filter('wp_update_attachment_metadata', 'fbw_update_attachment_filesize', 10, 2);

function fbw_update_attachment_filesize($data, $attachment_id) {
    // Verificar si es un PDF que fue comprimido
    if (get_post_mime_type($attachment_id) !== 'application/pdf') {
        return $data;
    }
    
    $compressed = get_post_meta($attachment_id, '_fbw_compressed', true);
    
    if ($compressed) {
        $file_path = get_attached_file($attachment_id);
        
        if (file_exists($file_path)) {
            // Actualizar el tamaño real del archivo
            $actual_size = filesize($file_path);
            
            if (isset($data['filesize']) && $data['filesize'] != $actual_size) {
                $data['filesize'] = $actual_size;
                error_log('FBW: Metadatos actualizados - Nuevo tamaño: ' . size_format($actual_size));
            }
        }
    }
    
    return $data;
}

// Guardar metadata de compresión
add_action('add_attachment', 'fbw_save_compression_metadata');

function fbw_save_compression_metadata($attachment_id) {
    // Verificar si es un PDF
    if (get_post_mime_type($attachment_id) !== 'application/pdf') {
        return;
    }
    
    // Buscar datos de compresión en el upload
    $upload_dir = wp_upload_dir();
    $file_path = get_attached_file($attachment_id);
    
    // Intentar obtener metadata desde el filtro wp_handle_upload
    $attached_file = get_post_meta($attachment_id, '_wp_attached_file', true);
    
    if ($attached_file) {
        $full_path = $upload_dir['basedir'] . '/' . $attached_file;
        
        // Verificar si tenemos metadata temporal
        $temp_meta = get_transient('fbw_compress_' . md5($full_path));
        
        if ($temp_meta) {
            update_post_meta($attachment_id, '_fbw_compressed', true);
            update_post_meta($attachment_id, '_fbw_compression_savings', $temp_meta['savings_percent']);
            update_post_meta($attachment_id, '_fbw_original_size', $temp_meta['original_size']);
            update_post_meta($attachment_id, '_fbw_compressed_size', $temp_meta['compressed_size']);
            
            delete_transient('fbw_compress_' . md5($full_path));
            
            error_log('FBW: Metadata de compresión guardada para attachment ID: ' . $attachment_id);
        }
    }
}

// Agregar columna de compresión en Media Library
add_filter('manage_media_columns', 'fbw_add_compression_column');
add_action('manage_media_custom_column', 'fbw_show_compression_status', 10, 2);

function fbw_add_compression_column($columns) {
    $columns['fbw_compressed'] = 'Compresión';
    return $columns;
}

function fbw_show_compression_status($column_name, $post_id) {
    if ($column_name === 'fbw_compressed' && wp_attachment_is('application/pdf', $post_id)) {
        $compressed = get_post_meta($post_id, '_fbw_compressed', true);
        if ($compressed) {
            $savings = get_post_meta($post_id, '_fbw_compression_savings', true);
            echo '<span style="color: #00a32a; font-weight: 600;">' . $savings . '%</span>';
        } else {
            echo '<span style="color: #999;">-</span>';
        }
    }
}

// Botón de compresión manual
add_filter('attachment_fields_to_edit', 'fbw_add_compress_button', 10, 2);

function fbw_add_compress_button($fields, $post) {
    if ($post->post_mime_type !== 'application/pdf') {
        return $fields;
    }
    
    $compressed = get_post_meta($post->ID, '_fbw_compressed', true);
    
    if (!$compressed) {
        $fields['fbw_compress'] = [
            'label' => 'Comprimir PDF',
            'input' => 'html',
            'html' => '<button type="button" class="button fbw-manual-compress" data-id="' . $post->ID . '">
                Comprimir ahora
            </button>
            <p class="description">Comprime este PDF manualmente usando iLovePDF API</p>
            <div class="fbw-compress-result" style="margin-top: 10px;"></div>
            <script>
            jQuery(document).ready(function($) {
                $(".fbw-manual-compress").on("click", function() {
                    var btn = $(this);
                    var id = btn.data("id");
                    var result = btn.siblings(".fbw-compress-result");
                    
                    btn.prop("disabled", true).text("Comprimiendo...");
                    result.html("<p>Procesando PDF con iLovePDF...</p>");
                    
                    $.post(ajaxurl, {
                        action: "fbw_manual_compress",
                        attachment_id: id,
                        nonce: "' . wp_create_nonce('fbw_manual_compress') . '"
                    }, function(response) {
                        if (response.success) {
                            result.html("<p style=\"color: #00a32a;\">" + response.data.message + "</p>");
                            btn.remove();
                            location.reload();
                        } else {
                            result.html("<p style=\"color: #dc3545;\">" + response.data.message + "</p>");
                            btn.prop("disabled", false).text("Comprimir ahora con iLovePDF");
                        }
                    });
                });
            });
            </script>'
        ];
    } else {
        $savings = get_post_meta($post->ID, '_fbw_compression_savings', true);
        $original_size = get_post_meta($post->ID, '_fbw_original_size', true);
        $compressed_size = get_post_meta($post->ID, '_fbw_compressed_size', true);
        
        $fields['fbw_compress'] = [
            'label' => 'Estado de Compresión',
            'input' => 'html',
            'html' => '<div style="background: #d4edda; padding: 10px; border-radius: 4px; border-left: 4px solid #28a745;">
                <strong style="color: #155724;">PDF Comprimido</strong><br>
                <small style="color: #155724;">
                    Ahorro: ' . $savings . '% (' . size_format($original_size) . ' &rarr; ' . size_format($compressed_size) . ')
                </small>
            </div>'
        ];
    }
    
    return $fields;
}

// AJAX para compresión manual
add_action('wp_ajax_fbw_manual_compress', 'fbw_ajax_manual_compress');

function fbw_ajax_manual_compress() {
    check_ajax_referer('fbw_manual_compress', 'nonce');
    
    if (!current_user_can('upload_files')) {
        wp_send_json_error(['message' => 'Permisos insuficientes']);
    }
    
    $attachment_id = intval($_POST['attachment_id']);
    
    if (!$attachment_id) {
        wp_send_json_error(['message' => 'ID de archivo inválido']);
    }
    
    $file_path = get_attached_file($attachment_id);
    
    if (!$file_path || !file_exists($file_path)) {
        wp_send_json_error(['message' => 'Archivo no encontrado']);
    }
    
    $public_key = get_option('fbw_ilovepdf_public_key');
    $secret_key = get_option('fbw_ilovepdf_secret_key');
    
    if (empty($public_key) || empty($secret_key)) {
        wp_send_json_error(['message' => 'API keys no configuradas']);
    }
    
    try {
        $original_size = filesize($file_path);
        $compressed_file = fbw_ilovepdf_compress($file_path, $public_key, $secret_key);
        
        if ($compressed_file && file_exists($compressed_file)) {
            $compressed_size = filesize($compressed_file);
            $savings = $original_size - $compressed_size;
            $savings_percent = round(($savings / $original_size) * 100);
            
            if ($savings_percent > 5) {
                rename($compressed_file, $file_path);
                
                update_post_meta($attachment_id, '_fbw_compressed', true);
                update_post_meta($attachment_id, '_fbw_compression_savings', $savings_percent);
                update_post_meta($attachment_id, '_fbw_original_size', $original_size);
                update_post_meta($attachment_id, '_fbw_compressed_size', $compressed_size);
                
                // Actualizar metadatos del attachment
                $metadata = wp_get_attachment_metadata($attachment_id);
                $metadata['filesize'] = $compressed_size;
                wp_update_attachment_metadata($attachment_id, $metadata);
                
                fbw_update_compression_stats($savings);
                
                wp_send_json_success([
                    'message' => "Comprimido exitosamente. Ahorro: {$savings_percent}% (" . 
                                 size_format($original_size) . " -> " . size_format($compressed_size) . ")"
                ]);
            } else {
                @unlink($compressed_file);
                wp_send_json_error(['message' => "Ahorro mínimo ({$savings_percent}%). No se reemplazó el archivo."]);
            }
        } else {
            wp_send_json_error(['message' => 'Error al comprimir el archivo']);
        }
    } catch (Exception $e) {
        wp_send_json_error(['message' => $e->getMessage()]);
    }
}

// 
// METABOX PARA CPT SERIES
// 

add_action('add_meta_boxes', function() {
    add_meta_box(
        'fbw_pdf_selector',
        'PDF Flipbook',
        'fbw_render_metabox',
        'vlogger_serie',
        'side',
        'high'
    );
});

function fbw_render_metabox($post) {
    wp_nonce_field('fbw_save_meta', 'fbw_meta_nonce');
    
    $pdf_id = get_post_meta($post->ID, '_fbw_pdf_id', true);
    $width = get_post_meta($post->ID, '_fbw_width', true) ?: '450';
    $height = get_post_meta($post->ID, '_fbw_height', true) ?: '600';
    
    $pdf_url = '';
    $pdf_name = '';
    if ($pdf_id) {
        $pdf_url = wp_get_attachment_url($pdf_id);
        $pdf_name = basename($pdf_url);
    }
    ?>
    
    <div class="fbw-metabox-wrapper">
        <div class="fbw-pdf-selector">
            <input type="hidden" id="fbw_pdf_id" name="fbw_pdf_id" value="<?php echo esc_attr($pdf_id); ?>">
            
            <button type="button" class="button button-primary fbw-select-pdf" style="width: 100%; padding: 8px;">
                <?php echo $pdf_id ? 'Cambiar PDF' : 'Seleccionar PDF'; ?>
            </button>
            
            <div class="fbw-pdf-preview" style="margin-top: 10px; <?php echo !$pdf_id ? 'display:none;' : ''; ?>">
                <div style="background: #f0f0f0; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">
                    <p style="margin: 0; font-size: 12px; color: #666;">
                        <strong>Archivo seleccionado:</strong>
                    </p>
                    <p style="margin: 5px 0 0; font-size: 11px; word-break: break-all;">
                        <span class="fbw-pdf-name"><?php echo esc_html($pdf_name); ?></span>
                    </p>
                    <a href="#" class="fbw-remove-pdf button button-small" style="margin-top: 8px; color: #d63638;">
                        Quitar PDF
                    </a>
                </div>
                
                <div style="margin-top: 10px; padding: 10px; background: #e7f3ff; border-radius: 4px;">
                    <iframe 
                        class="fbw-pdf-iframe" 
                        src="<?php echo esc_url($pdf_url); ?>#toolbar=0&navpanes=0&scrollbar=0" 
                        style="width: 100%; height: 200px; border: 1px solid #ddd; border-radius: 3px;"
                    ></iframe>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 20px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                Dimensiones del Flipbook:
            </label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                    <label style="font-size: 11px; display: block; margin-bottom: 3px;">Ancho (px)</label>
                    <input 
                        type="number" 
                        name="fbw_width" 
                        value="<?php echo esc_attr($width); ?>" 
                        min="200" 
                        max="1000"
                        style="width: 100%;"
                    >
                </div>
                <div>
                    <label style="font-size: 11px; display: block; margin-bottom: 3px;">Alto (px)</label>
                    <input 
                        type="number" 
                        name="fbw_height" 
                        value="<?php echo esc_attr($height); ?>" 
                        min="200" 
                        max="1200"
                        style="width: 100%;"
                    >
                </div>
            </div>
            <p style="margin: 8px 0 0; font-size: 11px; color: #666;">
                Recomendado: 450 x 600 px
            </p>
        </div>
    </div>
    
    <script>
    jQuery(document).ready(function($) {
        var mediaUploader;
        
        $('.fbw-select-pdf').on('click', function(e) {
            e.preventDefault();
            
            if (mediaUploader) {
                mediaUploader.open();
                return;
            }
            
            mediaUploader = wp.media({
                title: 'Seleccionar PDF para Flipbook',
                button: { text: 'Usar este PDF' },
                library: { type: 'application/pdf' },
                multiple: false
            });
            
            mediaUploader.on('select', function() {
                var attachment = mediaUploader.state().get('selection').first().toJSON();
                
                $('#fbw_pdf_id').val(attachment.id);
                $('.fbw-pdf-name').text(attachment.filename);
                $('.fbw-pdf-iframe').attr('src', attachment.url + '#toolbar=0&navpanes=0&scrollbar=0');
                $('.fbw-pdf-preview').fadeIn();
            });
            
            mediaUploader.open();
        });
        
        $('.fbw-remove-pdf').on('click', function(e) {
            e.preventDefault();
            $('#fbw_pdf_id').val('');
            $('.fbw-pdf-preview').fadeOut();
        });
    });
    </script>
    
    <style>
        .fbw-metabox-wrapper { padding: 5px 0; }
        .fbw-select-pdf { 
            height: 40px !important; 
            font-size: 14px !important;
        }
    </style>
    <?php
}

add_action('save_post_vlogger_serie', function($post_id) {
    if (!isset($_POST['fbw_meta_nonce']) || !wp_verify_nonce($_POST['fbw_meta_nonce'], 'fbw_save_meta')) {
        return;
    }
    
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }
    
    if (!current_user_can('edit_post', $post_id)) {
        return;
    }
    
    $pdf_id = isset($_POST['fbw_pdf_id']) ? absint($_POST['fbw_pdf_id']) : 0;
    $width = isset($_POST['fbw_width']) ? absint($_POST['fbw_width']) : 450;
    $height = isset($_POST['fbw_height']) ? absint($_POST['fbw_height']) : 600;
    
    update_post_meta($post_id, '_fbw_pdf_id', $pdf_id);
    update_post_meta($post_id, '_fbw_width', $width);
    update_post_meta($post_id, '_fbw_height', $height);
});

// 
// INYECCIÓN AUTOMÁTICA EN SERIES
// 

add_filter('the_content', function($content) {
    if (!is_singular('vlogger_serie')) {
        return $content;
    }
    
    $pdf_id = get_post_meta(get_the_ID(), '_fbw_pdf_id', true);
    
    if (!$pdf_id) {
        return $content;
    }
    
    $pdf_url = wp_get_attachment_url($pdf_id);
    $width = get_post_meta(get_the_ID(), '_fbw_width', true) ?: '450';
    $height = get_post_meta(get_the_ID(), '_fbw_height', true) ?: '600';
    
    $flipbook = fbw_render_flipbook([
        'pdf_url' => $pdf_url,
        'width' => $width,
        'height' => $height
    ]);
    
    return $content . $flipbook;
});

// 
// SHORTCODE Y RENDERIZADO
// 

add_shortcode('flipbook_pdf', function($atts) {
    $atts = shortcode_atts([
        'id' => 0,
        'url' => '',
        'width' => '450',
        'height' => '600'
    ], $atts);
    
    $pdf_url = '';
    
    if ($atts['id']) {
        $pdf_url = wp_get_attachment_url(absint($atts['id']));
    } elseif ($atts['url']) {
        $pdf_url = esc_url($atts['url']);
    }
    
    if (!$pdf_url) {
        return '<p style="color: #dc3545;">No se especificó un PDF válido</p>';
    }
    
    return fbw_render_flipbook([
        'pdf_url' => $pdf_url,
        'width' => $atts['width'],
        'height' => $atts['height']
    ]);
});

function fbw_render_flipbook($args) {
    $args = wp_parse_args($args, [
        'pdf_url' => '',
        'width' => '450',
        'height' => '600'
    ]);
    
    if (empty($args['pdf_url'])) {
        return '<p style="color: #dc3545;">URL del PDF no válida</p>';
    }
    
    $unique_id = 'flipbook_' . uniqid();
    
    ob_start();
    ?>
    <div class="fbw-flipbook-container">
        <div id="<?php echo esc_attr($unique_id); ?>" 
             class="fbw-flipbook-wrapper loading"
             data-pdf-url="<?php echo esc_url($args['pdf_url']); ?>"
             data-width="<?php echo esc_attr($args['width']); ?>"
             data-height="<?php echo esc_attr($args['height']); ?>">
            
            <div class="fbw-loading">
                <div class="fbw-spinner"></div>
            </div>
        </div>
        
        <div class="fbw-controls">
            <button class="fbw-prev" disabled title="Página anterior">&lsaquo;</button>
            <button class="fbw-next" title="Página siguiente">&rsaquo;</button>
        </div>
        
        <div class="fbw-page-info-wrapper">
            <span class="fbw-page-info">
                Página <span class="current-page">1</span> de <span class="total-pages">-</span>
            </span>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

// 
// ENQUEUE ASSETS
// 

add_action('wp_enqueue_scripts', 'fbw_enqueue_frontend_assets');
add_action('admin_enqueue_scripts', 'fbw_enqueue_admin_assets');

function fbw_enqueue_frontend_assets() {
    if (!is_singular('vlogger_serie')) {
        return;
    }
    
    // CSS
    wp_enqueue_style(
        'fbw-flipbook-css',
        FBW_PLUGIN_URL . 'assets/css/flipbook.css',
        [],
        FBW_VERSION
    );
    
    // jQuery
    wp_enqueue_script('jquery');
    
    // PDF.js
    wp_enqueue_script(
        'fbw-pdfjs',
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        [],
        null,
        false
    );
    
    // ✅ StPageFlip — alojado localmente (assets/js/page-flip.browser.js)
    wp_enqueue_script(
        'fbw-stpageflip',
        FBW_PLUGIN_URL . 'assets/js/page-flip.browser.js',
        [],
        '2.0.7',
        false  // en el HEAD para que cargue ANTES que flipbook.js
    );
    
    // Script principal
    wp_enqueue_script(
        'fbw-flipbook-js',
        FBW_PLUGIN_URL . 'assets/js/flipbook.js',
        ['jquery', 'fbw-pdfjs', 'fbw-stpageflip'],
        FBW_VERSION,
        true
    );
    
    // Worker de PDF.js
    wp_add_inline_script('fbw-pdfjs', "
        pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    ", 'after');
}

function fbw_enqueue_admin_assets($hook) {
    if ($hook !== 'post.php' && $hook !== 'post-new.php') {
        return;
    }
    
    $screen = get_current_screen();
    if (!$screen || $screen->post_type !== 'vlogger_serie') {
        return;
    }
    
    wp_enqueue_media();
}