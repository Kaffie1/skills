# <模块名> 接口说明

## 1. Topic 总览

| 话题名 | 消息类型 | 说明 |
|--------|----------|------|
| `<topic_name>` | `<msg_type>` | `<description>` |

## 2. Service 总览

| 服务名 | 消息类型 | 说明 |
|--------|----------|------|
| `<service_name>` | `<srv_type>` | `<description>` |

## 3. 参数

| 参数名 | 默认值 | 说明 |
|--------|--------|------|
| `<param_name>` | `<default_value>` | `<description>` |

## 4. Topic 详细说明

### 4.1 `<topic_name>`
- 消息类型：`<msg_type>`
- 接口类型：`topic`
- 说明：`<description>`

消息内容：
```text
<msg_type>

<field_type> <field_name>  # <comment>
```

CLI 示例：
```bash
<topic_cli_example>
```

Python 示例：
```python
<topic_python_example>
```

## 5. Service 详细说明

### 5.1 `<service_name>`
- 消息类型：`<srv_type>`
- 接口类型：`service`
- 说明：`<description>`

请求内容：
```text
<srv_type>

<request_field_type> <request_field_name>  # <comment>
---
<response_field_type> <response_field_name>  # <comment>
```

响应内容：
```text
<srv_type>

<request_field_type> <request_field_name>  # <comment>
---
<response_field_type> <response_field_name>  # <comment>
```

CLI 示例：
```bash
<service_cli_example>
```

Python 示例：
```python
<service_python_example>
```

## 6. 常用命令

```bash
<start_command>
<inspect_command>
<call_command>
```
